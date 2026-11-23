"""Banc d'Hermes (JARVIS OS) : un faux modèle compatible OpenAI, un faux Telegram (Bot API) et un faux
serveur MCP de JARVIS.

Données inventées seulement. Aucun appel réseau sortant : tout reste sur 127.0.0.1.

  python3 -I faux_services.py <port_modele> <port_telegram> <dossier_traces> [<port_jarvis>]

- Faux JARVIS (si le 4e argument est donné) : POST /mcp (MCP « Streamable HTTP », réponses JSON), ouvert au seul
  jeton JETON_JARVIS ; trois outils (pilotage_lire, pilotage_ajouter, jarvis_notifier) ; chaque requête est écrite
  dans <dossier>/jarvis.jsonl, jeton compris, pour vérifier qu'Hermes l'envoie bien en en-tête.

- Faux modèle : POST /v1/chat/completions (avec ou sans flux), GET /v1/models. Chaque requête est
  écrite dans <dossier>/modele.jsonl (pour vérifier les outils qu'Hermes annonce au modèle).
- Faux Telegram : /bot<jeton>/<méthode>. Les messages à livrer s'ajoutent par
  POST /controle/pousser {"de": 111, "texte": "..."} ; tout ce que le bot envoie est écrit dans
  <dossier>/telegram.jsonl.
"""
import json
import sys
import threading
import time
import urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

PORT_MODELE, PORT_TG, TRACES = int(sys.argv[1]), int(sys.argv[2]), sys.argv[3]
REPONSE = "Bonjour, ici Hermes sur le banc (faux modèle)."
verrou = threading.Lock()
file_attente, prochain_update, prochain_message = [], [int(time.time())], [1000]   # numéros toujours croissants, même après un redémarrage
BOT = {"id": 999000, "is_bot": True, "first_name": "Hermes banc", "username": "hermes_banc_bot",
       "can_join_groups": True, "can_read_all_group_messages": False, "supports_inline_queries": False}


def tracer(fichier, obj):
    with verrou, open(f"{TRACES}/{fichier}", "a", encoding="utf-8") as f:
        f.write(json.dumps(obj, ensure_ascii=False) + "\n")


def lire_corps(h):
    n = int(h.headers.get("content-length") or 0)
    brut = h.rfile.read(n) if n else b""
    genre = h.headers.get("content-type", "")
    if "json" in genre:
        try:
            return json.loads(brut or b"{}")
        except ValueError:
            return {}
    if "x-www-form-urlencoded" in genre:
        return {k: v[0] for k, v in urllib.parse.parse_qs(brut.decode("utf-8", "replace")).items()}
    if "multipart/form-data" in genre:
        champs, limite = {}, genre.split("boundary=")[-1].strip().strip('"').encode()
        for part in brut.split(b"--" + limite):
            if b"\r\n\r\n" not in part:
                continue
            tete, valeur = part.split(b"\r\n\r\n", 1)
            nom = tete.decode("utf-8", "replace").split('name="')[-1].split('"')[0]
            champs[nom] = valeur.rstrip(b"\r\n-").decode("utf-8", "replace")
        return champs
    return {}


class Modele(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def _json(self, code, obj):
        corps = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("content-type", "application/json")
        self.send_header("content-length", str(len(corps)))
        self.end_headers()
        self.wfile.write(corps)

    def do_GET(self):
        if self.path.rstrip("/").endswith("/models"):
            return self._json(200, {"object": "list", "data": [{"id": "faux-modele", "object": "model", "context_length": 200000}]})
        self._json(404, {"error": "inconnu"})

    def do_POST(self):
        corps = lire_corps(self)
        tracer("modele.jsonl", {"chemin": self.path, "corps": corps})
        if not self.path.rstrip("/").endswith("/chat/completions"):
            return self._json(404, {"error": "inconnu"})
        modele, now = corps.get("model", "faux-modele"), int(time.time())
        texte, appel = reponse_scenario(corps.get("messages") or [])
        if appel:   # le faux modèle demande un outil (scénario « APPELLE: {...} » écrit par le banc)
            message = {"role": "assistant", "content": None, "tool_calls": [
                {"id": "appel1", "type": "function", "function": {"name": appel["nom"], "arguments": json.dumps(appel.get("args") or {})}}]}
            fin, delta = "tool_calls", {"role": "assistant", "tool_calls": [dict(message["tool_calls"][0], index=0)]}
        else:
            message, fin, delta = {"role": "assistant", "content": texte}, "stop", {"role": "assistant", "content": texte}
        if corps.get("stream"):
            self.send_response(200)
            self.send_header("content-type", "text/event-stream")
            self.end_headers()
            for morceau, raison in ((delta, None), ({}, fin)):
                evt = {"id": "faux", "object": "chat.completion.chunk", "created": now, "model": modele,
                       "choices": [{"index": 0, "delta": morceau, "finish_reason": raison}]}
                self.wfile.write(b"data: " + json.dumps(evt).encode() + b"\n\n")
            usage = {"id": "faux", "object": "chat.completion.chunk", "created": now, "model": modele, "choices": [],
                     "usage": {"prompt_tokens": 10, "completion_tokens": 10, "total_tokens": 20}}
            self.wfile.write(b"data: " + json.dumps(usage).encode() + b"\n\ndata: [DONE]\n\n")
            return
        self._json(200, {"id": "faux", "object": "chat.completion", "created": now, "model": modele,
                         "choices": [{"index": 0, "message": message, "finish_reason": fin}],
                         "usage": {"prompt_tokens": 10, "completion_tokens": 10, "total_tokens": 20}})


def texte_de(contenu):
    if isinstance(contenu, list):
        return " ".join(p.get("text", "") for p in contenu if isinstance(p, dict))
    return str(contenu or "")


def reponse_scenario(messages):
    """Réponse fixe ; « APPELLE: {"nom": ..., "args": ...} » dans le dernier message de l'utilisateur fait
    demander cet outil au faux modèle ; après le résultat de l'outil, il le recopie dans sa réponse."""
    dernier = messages[-1] if messages else {}
    if dernier.get("role") == "tool":
        return "Résultat de l'outil : " + texte_de(dernier.get("content"))[:400], None
    texte = texte_de(dernier.get("content"))
    if "APPELLE:" in texte:
        try:
            return None, json.loads(texte.split("APPELLE:", 1)[1].strip())
        except ValueError:
            pass
    return REPONSE, None


def message_bot(chat_id, texte):
    with verrou:
        prochain_message[0] += 1
        mid = prochain_message[0]
    return {"message_id": mid, "date": int(time.time()), "from": BOT,
            "chat": {"id": int(chat_id), "type": "private", "first_name": "Banc"}, "text": texte or ""}


class Telegram(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def _ok(self, resultat):
        corps = json.dumps({"ok": True, "result": resultat}).encode()
        self.send_response(200)
        self.send_header("content-type", "application/json")
        self.send_header("content-length", str(len(corps)))
        self.end_headers()
        self.wfile.write(corps)

    def do_GET(self):
        self.do_POST()

    def do_POST(self):
        corps = lire_corps(self)
        if self.path == "/controle/pousser":
            de = int(corps["de"])
            with verrou:
                uid = prochain_update[0]
                prochain_update[0] += 1
                file_attente.append({"update_id": uid, "message": {
                    "message_id": uid, "date": int(time.time()), "text": corps["texte"],
                    "from": {"id": de, "is_bot": False, "first_name": f"Personne {de}", "language_code": "fr"},
                    "chat": {"id": de, "type": "private", "first_name": f"Personne {de}"},
                    **({"entities": [{"type": "bot_command", "offset": 0, "length": len(corps["texte"].split()[0])}]}
                       if corps["texte"].startswith("/") else {})}})
            return self._ok(True)
        methode = self.path.rsplit("/", 1)[-1]
        if methode not in ("getUpdates",):
            tracer("telegram.jsonl", {"methode": methode, "corps": corps})
        if methode == "getMe":
            return self._ok(BOT)
        if methode == "getUpdates":
            decalage = int(corps.get("offset") or 0)
            fin = time.time() + min(float(corps.get("timeout") or 0), 2.0)
            while True:
                with verrou:
                    prets = [u for u in file_attente if u["update_id"] >= decalage]
                    del file_attente[: len(file_attente) - len(prets)]
                if prets or time.time() >= fin:
                    return self._ok(prets)
                time.sleep(0.1)
        if methode == "getWebhookInfo":
            return self._ok({"url": "", "has_custom_certificate": False, "pending_update_count": 0})
        if methode in ("getMyCommands",):
            return self._ok([])
        if methode == "getChat":
            return self._ok({"id": int(corps.get("chat_id") or 0), "type": "private", "first_name": "Banc"})
        if methode.startswith(("send", "edit", "copy", "forward")) and methode not in ("sendChatAction", "sendMessageDraft"):
            return self._ok(message_bot(corps.get("chat_id") or 0, corps.get("text") or corps.get("caption")))
        return self._ok(True)


JETON_JARVIS = "jvf_faux-jeton-du-banc-0123456789"
OUTILS_JARVIS = [
    {"name": "pilotage_lire", "description": "Lit un onglet de Pilotage (banc).",
     "inputSchema": {"type": "object", "properties": {"onglet": {"type": "string"}}, "required": ["onglet"]}},
    {"name": "pilotage_ajouter", "description": "Ajoute une ligne à un onglet de Pilotage (banc).",
     "inputSchema": {"type": "object", "properties": {"onglet": {"type": "string"}, "valeurs": {"type": "object"}}, "required": ["onglet", "valeurs"]}},
    {"name": "jarvis_notifier", "description": "Notifie le propriétaire (banc).",
     "inputSchema": {"type": "object", "properties": {"titre": {"type": "string"}, "texte": {"type": "string"}}, "required": ["titre", "texte"]}},
    {"name": "gmail_chercher", "description": "Cherche dans les mails (banc) : réservé au jeton « exécutant ».",
     "inputSchema": {"type": "object", "properties": {"requete": {"type": "string"}}, "required": ["requete"]}},
    {"name": "outil_hors_liste", "description": "Un outil que la politique d'Hermes ne retient pas (banc).",
     "inputSchema": {"type": "object", "properties": {}}},
]
JETON_JARVIS_WEB = "jvf_faux-jeton-veilleur-0123456789"      # second jeton, profil « veilleur » : ni mails ni outil hors liste
OUTILS_VEILLEUR = ("pilotage_lire", "pilotage_ajouter", "jarvis_notifier")


class Jarvis(BaseHTTPRequestHandler):
    """Le strict nécessaire du serveur MCP de JARVIS (jarvis-os/server/mcp.mjs) : initialize, tools/list, tools/call."""

    def log_message(self, *a):
        pass

    def _json(self, code, obj=None, extra=()):
        corps = b"" if obj is None else json.dumps(obj, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header("content-type", "application/json; charset=utf-8")
        self.send_header("content-length", str(len(corps)))
        for k, v in extra:
            self.send_header(k, v)
        self.end_headers()
        self.wfile.write(corps)

    def do_GET(self):
        self._json(405 if self.path == "/mcp" else 404, {"error": "POST seulement"})

    def do_POST(self):
        corps, jeton = lire_corps(self), self.headers.get("authorization", "")
        tracer("jarvis.jsonl", {"chemin": self.path, "autorisation": jeton, "corps": corps})
        if self.path != "/mcp":
            return self._json(404, {"error": "inconnu"})
        if jeton not in ("Bearer " + JETON_JARVIS, "Bearer " + JETON_JARVIS_WEB):
            return self._json(401, {"error": "invalid_token"}, (("www-authenticate", 'Bearer error="invalid_token"'),))
        veilleur = jeton == "Bearer " + JETON_JARVIS_WEB
        methode, ident, p = corps.get("method", ""), corps.get("id"), corps.get("params") or {}
        if ident is None:
            return self._json(202)
        if methode == "initialize":
            res = {"protocolVersion": p.get("protocolVersion") or "2025-06-18", "capabilities": {"tools": {"listChanged": False}},
                   "serverInfo": {"name": "jarvis-os", "version": "banc"}}
        elif methode == "tools/list":
            res = {"tools": [o for o in OUTILS_JARVIS if o["name"] in OUTILS_VEILLEUR] if veilleur else OUTILS_JARVIS}
        elif methode == "tools/call":
            a = p.get("arguments") or {}
            textes = {"pilotage_lire": "Onglet %s (banc)\nL2 | Bot: Iris | Dernier passage: 23/11/2026 09h10" % a.get("onglet"),
                      "pilotage_ajouter": "Ligne ajoutée à %s (banc)." % a.get("onglet"), "jarvis_notifier": "Notifié (banc).",
                      "gmail_chercher": "Aucun fil (banc)."}
            if veilleur:
                textes = {k: v + " [jeton veilleur]" for k, v in textes.items() if k in OUTILS_VEILLEUR}
            res = {"content": [{"type": "text", "text": textes.get(p.get("name"), "Outil inconnu")}], "isError": p.get("name") not in textes}
        elif methode == "ping":
            res = {}
        else:
            res = {"resources": []} if methode == "resources/list" else {"prompts": []} if methode == "prompts/list" else None
        if res is None:
            return self._json(200, {"jsonrpc": "2.0", "id": ident, "error": {"code": -32601, "message": "Méthode inconnue"}})
        self._json(200, {"jsonrpc": "2.0", "id": ident, "result": res})


services = [(PORT_MODELE, Modele), (PORT_TG, Telegram)] + ([(int(sys.argv[4]), Jarvis)] if len(sys.argv) > 4 else [])
for port, gestion in services:
    serveur = ThreadingHTTPServer(("127.0.0.1", port), gestion)
    threading.Thread(target=serveur.serve_forever, daemon=True).start()
print("faux services prêts", flush=True)
while True:
    time.sleep(3600)
