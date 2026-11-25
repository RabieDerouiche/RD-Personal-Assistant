#!/usr/bin/env python3
"""Banc d'Hermes : le filtre d'appels système de systemd, sans systemd (essais/hermes/portail.test.sh).

Le conteneur du banc n'a pas systemd : rien n'y applique « SystemCallFilter= » ni « RestrictNamespaces= » de
l'unité d'un passage. Ce programme lit ces lignes dans l'unité, construit le même filtre avec libseccomp, le pose
sur lui-même puis lance la commande : le navigateur et Hermes tournent alors sous les mêmes interdits que sur le
serveur. Les groupes (@system-service, @privileged…) sont ceux du systemd installé ici (systemd-analyze).

  python3 -I filtre_appels.py --unite /etc/systemd/system/hermes-portail-essai.service -- commande arguments…
  python3 -I filtre_appels.py --unite … --liste        (affiche les appels permis, sans rien lancer)

Ce que systemd fait et que ceci reproduit : appels hors liste refusés avec l'erreur de SystemCallErrorNumber= ;
avec RestrictNamespaces=yes, setns refusé, unshare et clone refusés dès qu'ils demandent un espace de noms, clone3
rendu « inexistant » (ENOSYS) pour que la libc revienne à clone.
"""
import ctypes, errno, os, re, subprocess, sys

ESPACES = 0x00020000 | 0x02000000 | 0x04000000 | 0x08000000 | 0x10000000 | 0x20000000 | 0x40000000 | 0x00000080
PERMIS, MASQUE_EGAL = 0x7fff0000, 7


def refus(code):
    return 0x00050000 | code


class Comparaison(ctypes.Structure):
    _fields_ = [('arg', ctypes.c_uint), ('op', ctypes.c_int), ('a', ctypes.c_uint64), ('b', ctypes.c_uint64)]


def groupe(nom, vus=None):
    """Les appels d'un groupe de systemd, groupes inclus dépliés."""
    vus = vus if vus is not None else set()
    if nom in vus:
        return set()
    vus.add(nom)
    sortie = subprocess.run(['systemd-analyze', '--no-pager', 'syscall-filter', nom], capture_output=True, text=True, check=True).stdout
    appels = set()
    for ligne in sortie.splitlines():
        if not ligne.startswith('    '):
            continue                      # le nom du groupe et sa description
        mot = re.sub(r'\x1b\[[0-9;]*m', '', ligne).strip()   # systemd-analyze colore les groupes inclus
        if mot.startswith('#') or not mot:
            continue
        appels |= groupe(mot, vus) if mot.startswith('@') else {mot}
    return appels


def lire_unite(chemin):
    permis, erreur, espaces, vu = set(), None, False, False
    for ligne in open(chemin, encoding='utf-8'):
        m = re.match(r'\s*(SystemCallFilter|SystemCallErrorNumber|RestrictNamespaces)\s*=\s*(.*?)\s*$', ligne)
        if not m:
            continue
        cle, valeur = m.groups()
        if cle == 'SystemCallErrorNumber':
            erreur = getattr(errno, valeur)
        elif cle == 'RestrictNamespaces':
            espaces = valeur in ('yes', 'true', '1')
        else:
            vu = True
            retire = valeur.startswith('~')
            for mot in valeur.lstrip('~').split():
                appels = groupe(mot) if mot.startswith('@') else {mot}
                permis = permis - appels if retire else permis | appels
    return (permis if vu else None), erreur, espaces


def poser(permis, erreur, espaces):
    lib = ctypes.CDLL('libseccomp.so.2', use_errno=True)
    lib.seccomp_init.restype = ctypes.c_void_p
    lib.seccomp_rule_add_array.argtypes = [ctypes.c_void_p, ctypes.c_uint32, ctypes.c_int, ctypes.c_uint, ctypes.POINTER(Comparaison)]
    lib.seccomp_load.argtypes = [ctypes.c_void_p]
    # sans SystemCallFilter=, tout est permis sauf ce que RestrictNamespaces= retire
    ctx = lib.seccomp_init(PERMIS if permis is None else refus(erreur or errno.EPERM))
    if not ctx:
        sys.exit('filtre_appels : libseccomp ne répond pas')
    numero = lambda nom: lib.seccomp_syscall_resolve_name(nom.encode())
    sans_espace = (Comparaison * 1)(Comparaison(0, MASQUE_EGAL, ESPACES, 0))   # (drapeaux & ESPACES) == 0

    def regle(action, nom, cmp=None):
        n = numero(nom)
        if n < 0:
            return                        # appel inconnu de ce processeur
        rc = lib.seccomp_rule_add_array(ctx, action, n, 1 if cmp else 0, cmp)
        if rc not in (0, -errno.EEXIST, -errno.EACCES):   # EACCES : la règle est déjà l'action par défaut
            sys.exit('filtre_appels : règle %s refusée (%d)' % (nom, rc))

    if permis is None:
        if espaces:
            regle(refus(errno.EPERM), 'setns'); regle(refus(errno.ENOSYS), 'clone3')
            for nom in ('unshare', 'clone'):
                for bit in [1 << i for i in range(32) if ESPACES >> i & 1]:
                    regle(refus(errno.EPERM), nom, (Comparaison * 1)(Comparaison(0, MASQUE_EGAL, bit, bit)))
    else:
        for nom in sorted(permis):
            if espaces and nom in ('setns', 'clone3'):
                continue
            regle(PERMIS, nom, sans_espace if espaces and nom in ('unshare', 'clone') else None)
        if espaces:
            regle(refus(errno.ENOSYS), 'clone3')
    rc = lib.seccomp_load(ctx)
    if rc:
        sys.exit('filtre_appels : le noyau refuse le filtre (%d)' % rc)


def main():
    args = sys.argv[1:]
    if len(args) < 3 or args[0] != '--unite':
        sys.exit(__doc__)
    permis, erreur, espaces = lire_unite(args[1])
    if args[2] == '--liste':
        print('\n'.join(sorted(permis or [])))
        print('# %s appels permis ; RestrictNamespaces=%s ; erreur %s' % (len(permis) if permis is not None else 'tous les', espaces, erreur), file=sys.stderr)
        return
    if args[2] != '--' or len(args) < 4:
        sys.exit(__doc__)
    poser(permis, erreur, espaces)
    os.execvp(args[3], args[3:])


main()
