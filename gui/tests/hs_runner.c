#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
int js_init(int); int js_load_file(int, const char *); int js_eval(int, const char *, const char *);
int js_emit(int, const char *, const char *); int js_tick(int); const char *js_poll_invoke(int);
int js_resolve(int, const char *, const char *); const char *js_last_error(int); int js_shutdown(int);

typedef struct { char *cmd, *sub, *json; } Mock;
static Mock M[256]; static int NM;
static int PASS, FAIL, TRACE;

static char *slurp(const char *p) {
    FILE *f = fopen(p, "rb"); if (!f) return NULL;
    fseek(f, 0, SEEK_END); long n = ftell(f); fseek(f, 0, SEEK_SET);
    char *b = malloc(n + 1); if (fread(b, 1, n, f) != (size_t)n) { fclose(f); return NULL; } b[n] = 0; fclose(f); return b;
}
static void load_mocks(const char *path) {
    char *t = slurp(path); if (!t) { fprintf(stderr, "no mocks: %s\n", path); exit(2); }
    for (char *line = strtok(t, "\n"); line && NM < 256; line = strtok(NULL, "\n")) {
        if (line[0] == '#' || !line[0]) continue;
        char *a = strchr(line, '\t'); if (!a) continue; *a++ = 0;
        char *b = strchr(a, '\t'); if (!b) continue; *b++ = 0;
        M[NM].cmd = strdup(line); M[NM].sub = strdup(a); M[NM].json = strdup(b); NM++;
    }
}
static const char *find_mock(const char *cmd, const char *args) {
    for (int i = 0; i < NM; i++)
        if (!strcmp(M[i].cmd, cmd) && (M[i].sub[0] == 0 || strstr(args, M[i].sub))) return M[i].json;
    return NULL;
}
static void handle(int j, char *inv) {
    char *c1 = strchr(inv, 1); if (!c1) return; *c1 = 0;
    char *id = inv, *cmd = c1 + 1;
    char *c2 = strchr(cmd, 1); if (!c2) return; *c2 = 0;
    char *args = c2 + 1;
    if (!strcmp(cmd, "__dom")) { js_resolve(j, id, "{}"); return; }
    if (!strcmp(cmd, "__report")) {
        int ok = strstr(args, "\"ok\":true") != NULL;
        const char *m = strstr(args, "\"msg\":"); printf("  %s %s\n", ok ? "PASS" : "FAIL", m ? m + 6 : args);
        if (ok) PASS++; else FAIL++;
        js_resolve(j, id, "{}"); return;
    }
    if (TRACE) printf("    [invoke] %s %s\n", cmd, strlen(args) > 160 ? "…" : args);
    if (!strcmp(cmd, "__dialog")) { js_resolve(j, id, strstr(args, "\"kind\":\"save\"") ? "{\"path\":\"/tmp/hs-export.txt\"}" : strstr(args, "\"kind\":\"folder\"") ? "{\"path\":\"/tmp/restore-here\"}" : "{\"ok\":true}"); return; }
    if (!strcmp(cmd, "job_start")) {
        const char *out = find_mock("task_output", args);
        char *p = strstr(args, "\"id\":\""); char jid[64] = "job-0";
        if (p) { p += 6; char *e = strchr(p, '"'); if (e && e - p < 60) { memcpy(jid, p, e - p); jid[e - p] = 0; } }
        js_resolve(j, id, "{\"queued\":true}");
        static char payload[300000];
        snprintf(payload, sizeof payload, "{\"id\":\"%s\",\"output\":%s}", jid, out ? out : "\"ok\\n@@rc=0\\n\"");
        js_emit(j, "silver://task", payload);
        return;
    }
    const char *r = find_mock(cmd, args);
    js_resolve(j, id, r ? r : "{}");
}
static void pump(int j, int ms) {
    for (int t = 0; t < ms; t += 2) {
        js_tick(j);
        const char *inv;
        while ((inv = js_poll_invoke(j))[0]) { char *b = strdup(inv); handle(j, b); free(b); }
        usleep(2000);
    }
}
int main(int argc, char **argv) {
    if (argc < 4) { fprintf(stderr, "usage: hs_runner bundle.js check.js mocks.tsv [run_ms]\n"); return 2; }
    TRACE = getenv("HS_TRACE") != NULL;
    load_mocks(argv[3]);
    int run_ms = argc > 4 ? atoi(argv[4]) : 3000;
    const char *snap =
      "[{\"i\":0,\"p\":-1,\"t\":\"root\",\"k\":[1],\"a\":{}},{\"i\":1,\"p\":0,\"t\":\"html\",\"k\":[2],\"a\":{}},"
      "{\"i\":2,\"p\":1,\"t\":\"body\",\"k\":[3],\"a\":{}},{\"i\":3,\"p\":2,\"t\":\"div\",\"k\":[],\"a\":{\"id\":\"root\"}}]";
    int j = js_init(0); if (j < 0) return 1;
    js_emit(j, "__dom_snapshot", snap);
    if (!js_load_file(j, argv[1])) { printf("LOAD ERROR: %s\n", js_last_error(j)); return 1; }
    char *chk = slurp(argv[2]);
    if (!chk || !js_eval(j, chk, argv[2])) { printf("CHECK ERROR: %s\n", js_last_error(j)); return 1; }
    pump(j, run_ms);
    js_shutdown(j);
    printf("%d passed, %d failed\n", PASS, FAIL);
    return (FAIL == 0 && PASS > 0) ? 0 : 1;
}
