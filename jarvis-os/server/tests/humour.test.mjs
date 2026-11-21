/* Banc de la personnalité à l'oral : node tests/humour.test.mjs (aucun Claude, aucun coût). */
import fs from 'node:fs'; import path from 'node:path'; import {fileURLToPath} from 'node:url';
import {pique, PERSO_ORAL} from '../humour.mjs';
const HERE = path.dirname(fileURLToPath(import.meta.url)), results = []; let fails = 0;
const ok = (name, cond, info) => { results.push((cond ? 'OK   ' : 'ÉCHEC') + ' ' + name + (info ? ' :: ' + info : '')); if (!cond) fails++; };
try {
  const a = pique('heure', 'Il est 14 h 05.', '14:05', () => 0);
  ok('Humour : la pique vient APRÈS l’information, qui reste intacte au début', a.startsWith('Il est 14 h 05. ') && a.length > 'Il est 14 h 05. '.length, a);
  ok('Humour : la pique dépend du moment (nuit, matin, soir)', /dorment|font semblant de dormir|choix de vie/.test(pique('heure', 'Il est 2 h 10.', '02:10', () => 0)) && /café|Debout|émerger/.test(pique('heure', 'Il est 7 h.', '07:00', () => 0))
    && /téléphone|remettre à demain|productif/.test(pique('heure', 'Il est 22 h 30.', '22:30', () => 0)));
  ok('Humour : météo de pluie → pique de pluie', /parapluie|au sec|tester/.test(pique('meteo', 'Demain : pluie à 80 %, entre 7 et 11 degrés.', '18:00', () => 0)));
  ok('Humour : jamais sur un sujet sérieux (médecin, découvert, crèche, enfants, relance)', ['Aujourd’hui, encore : 10 h, rendez-vous médecin.', '2 choses pour toi : Découvert ; Assurance.', 'Aujourd’hui, encore : 8 h 30, crèche.', 'Dernière demande à Iris : « Relance syndic ». Pas encore traitée.'].every((r) => pique(r.startsWith('2') ? 'pourmoi' : r.startsWith('Dern') ? 'bot' : 'agenda', r, '09:00', () => 0) === r));
  const b1 = pique('date', 'Nous sommes le samedi 21 novembre.', '10:00', () => 0), b2 = pique('date', 'Nous sommes le samedi 21 novembre.', '10:00', () => 0);
  ok('Humour : pas deux fois la même pique de suite', b1 !== b2, b1 + ' / ' + b2);
  process.env.JARVIS_HUMOUR = '0'; const c = pique('heure', 'Il est 14 h 05.', '14:05'); delete process.env.JARVIS_HUMOUR;
  ok('Humour : JARVIS_HUMOUR=0 le coupe', c === 'Il est 14 h 05.');
  ok('Humour : la consigne orale garde les garde-fous (l’info d’abord, rien sur la santé, l’argent difficile, un deuil, la famille)', /L'information d'abord/.test(PERSO_ORAL) && /santé/.test(PERSO_ORAL) && /argent difficile/.test(PERSO_ORAL) && /deuil/.test(PERSO_ORAL) && /sa famille/.test(PERSO_ORAL) && /sarcastique assumé/.test(PERSO_ORAL));
  const page = fs.readFileSync(path.join(HERE, '..', '..', '..', 'essais', 'jarvis-os-maquette', 'index.html'), 'utf8'), srv = fs.readFileSync(path.join(HERE, '..', 'server.mjs'), 'utf8');
  ok('Humour : la page (discussion lue à voix haute) porte exactement la même consigne que le serveur', page.includes('const VOIX_PERSO = "' + PERSO_ORAL + '";'));
  ok('Humour : Siri et l’ancienne voix la reçoivent aussi ; les réponses instantanées des mains libres reçoivent leur pique', (srv.match(/\$\{PERSO_ORAL\}/g) || []).length === 2 && (srv.match(/reply = pique\(q\.kind, reply/g) || []).length === 2);
} catch (e) { ok('exception', false, e.stack); }
console.log(results.join('\n')); console.log(fails ? fails + ' échec(s)' : 'Tout passe (' + results.length + ' vérifications).');
process.exit(fails ? 1 : 0);
