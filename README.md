# HackerOS Snapshots

Snapshoty systemu plików dla HackerOS — **btrfs** i **ext4**, wzorowane na `snapper`.
Napisane w **H#**, budowane przez **bit**, GUI w **Silver**.

- działa w tle (usługa systemd); **przy każdym starcie** robi snapshot „boot” i **usuwa stare snapshoty** wg reguł użytkownika,
- **wiele konfiguracji** (`root`, `home`, …) — każda z własnymi regułami, jak w snapperze,
- **diff** dwóch snapshotów (lub snapshotu i działającego systemu), **przeglądanie** snapshotu i **przywracanie pojedynczych plików/katalogów** bez pełnego rollbacku,
- rollback całego systemu + wpisy w **GRUB-ie** startujące **jądro z danego snapshotu**,
- **limity miejsca**: min. wolne %, max. % dysku zajęte przez snapshoty (btrfs qgroups / `du` na ext4), awaryjne czyszczenie,
- **automatyczne sprzątanie starych rootów** po rollbacku (`@.before-rollback-*`),
- **kopie zewnętrzne**: `btrfs send/receive` lub `rsync` na drugi dysk albo przez SSH,
- **powiadomienia** (notify-send + journald + plik logu) i **ikona w trayu**,
- CLI (`hackeros-snapshots`) + GUI (`hackeros-snapshots-gui`, Silver 0.2 + TypeScript + Solid.js): pulpit, lista z filtrami, diff, przeglądarka plików, ustawienia, kreator instalacji, historia zadań w tle.

> **Status: kod nie był kompilowany ani uruchamiany.** Nie ma go czym zbudować w środowisku, w którym powstał (brak toolchaina H# i SDL2).
> Co **zostało sprawdzone**: parsery diffa i logika przywracania na prawdziwym `rsync`/`awk` (`sh tests/run.sh`, 6 testów przechodzi),
> komendy shellowe, które program składa (rsync, find, du, sed, date), oraz statycznie cały kod H# — własnym linterem
> (istnienie funkcji między modułami, liczba argumentów, deklaracje `mod`, klucze konfiguracji, kolejność definicji, balans `is`/`end`).
> GUI (od 0.3): front-end TypeScript + Solid przechodzi `tsc`, 10 testów parserów i 37 kontroli scenariusza UI w warstwie JS Silvera (QuickJS + lustro DOM) na zamockowanych odpowiedziach backendu; składnia nowego `gui/src/*.h#` przeszła parser H#.
> Nie sprawdzono: kompilacji H#, działania na btrfs (`btrfs send/receive`, qgroups, rollback), GRUB-a, GUI w Silverze.
> Przed użyciem: `h# check src/main.h#` i test na **maszynie wirtualnej** (patrz „Testowanie”).

## Szybki start

```sh
bit                                   # buduje cache/build/release/hackeros-snapshots
(cd gui && bit)                       # opcjonalnie GUI (najpierw natywne shimy Silvera, patrz gui/README.md)
sudo ./packaging/install.sh
sudo hackeros-snapshots init          # pokazuje CO zostanie zmienione, pyta o zgodę, przygotowuje magazyn
sudo systemctl enable --now hackeros-snapshots
hackeros-snapshots-gui                # albo zakładka „Setup” zamiast init w terminalu
```

Zależności: `btrfs-progs` (btrfs) lub `rsync` (ext4, diff, przywracanie), `util-linux`, `grub` (opcjonalnie),
`polkit` + `libnotify-bin` (GUI/powiadomienia), `yad` (ikona w trayu).

## Jak to działa

| | btrfs | ext4 |
|---|---|---|
| snapshot | read-only subwolumin, natychmiastowy | drzewo `rsync` z twardymi linkami (`--link-dest`) |
| magazyn `root` | osobny subwolumin `@snapshots` na `/.snapshots` | katalog `/.snapshots` |
| magazyn innych configów | zagnieżdżony subwolumin `<źródło>/.snapshots` | katalog `<źródło>/.snapshots` |
| rollback `root` | zamiana subwolumina root (`@` → `@.before-rollback-<data>`) | `rsync --delete` snapshot → `/` |
| rollback innych configów | `rsync --delete` (zamontowanego subwolumina nie da się podmienić) | `rsync --delete` |
| diff | `btrfs send --no-data \| btrfs receive --dump` (tylko metadane, szybkie; wymaga roota) | `rsync -n -i` |
| miejsce zajęte przez snapshot | qgroups (`exclusive`) | `du -sm` od najnowszego |

Układ magazynu (jak snapper): `<store>/<id>/snapshot` + `<store>/<id>/info`.

### Start systemu → czyszczenie
Dla **każdej** włączonej konfiguracji: snapshot `boot` → **czyszczenie** (liczba / wiek / miejsce, stare rooty po rollbacku) → kopia zewnętrzna → odświeżenie GRUB-a.
Potem co minutę: czy należy się snapshot `timeline` (po nim czyszczenie i kopia zewnętrzna). Konfigi są czytane na nowo w każdej pętli.

### Reguły czyszczenia (`config set …` / GUI → Settings; **0 = bez limitu**)
1. `keep_boot`, `keep_timeline`, `keep_manual`, `keep_prepost` (pary pre/post),
2. `max_age_days`,
3. `max_usage_percent` — snapshoty mogą zająć najwyżej tyle % dysku (najstarsze idą pierwsze; btrfs: wymaga qgroups — `init` je włącza; ext4: liczone `du` przy starcie i przy `cleanup`, bo przechodzi po wszystkich drzewach),
4. **nigdy nie są usuwane**: przypięte (`pin`) i `keep_min` najnowszych.

### Miejsce na dysku
Przed **każdym** snapshotem: jeśli wolne < `min_free_percent` (domyślnie 10) → (gdy `emergency_cleanup`) kasowane są najstarsze nieprzypięte snapshoty, aż będzie dość miejsca; jeśli nadal za mało — snapshot **nie powstaje** i dostajesz powiadomienie. Demon dodatkowo ostrzega, gdy do progu zostało < 5 p.p.

### Stare rooty po rollbacku (btrfs)
Po rollbacku poprzedni root zostaje jako `@.before-rollback-<data>`. Sprząta je `roots::prune` (przy starcie, przy `cleanup`, `roots prune`):
kasuje starsze niż `rollback_root_days` (14) i wszystko ponad `keep_rollback_roots` (3) najnowszych. **Root, który jest jeszcze zamontowany** (rollback zrobiony, reboot nie), nigdy nie jest ruszany.
Do restartu blokowany jest drugi rollback i automatyczne snapshoty roota.

### GRUB — zmiana na inny snapshot, z właściwym jądrem
Podmenu **HackerOS Snapshots** z wpisami `Restore: snapshot #N …`. Wpis startuje `init=/usr/lib/hackeros-snapshots/restore-init hsnap.restore=N`; ten skrypt (PID 1, przed systemd) woła `hackeros-snapshots rollback N --offline` i na btrfs restartuje, na ext4 bootuje dalej.
Każdy snapshot pamięta `kver` (jądro z chwili wykonania). Wpis wybiera: (1) `vmlinuz`+`initrd` **z samego snapshotu** (`/boot` wewnątrz snapshotu), (2) tę samą wersję z bieżącego `/boot`, (3) najnowsze jądro (zaznaczone w tytule). Tylko dla configu `root`.

### Diff i przywracanie plików
```sh
hackeros-snapshots diff 5 8               # co zmieniło się między #5 a #8   (+ dodane  - usunięte  ~ zmienione  > przemianowane)
sudo hackeros-snapshots diff 5            # #5 → system teraz
hackeros-snapshots browse 5 /etc          # zawartość katalogu w snapshocie
sudo hackeros-snapshots restore 5 /etc/fstab /home/ja/dokumenty   # z kopią tego, co nadpisane
     → kopie zapasowe: /var/lib/hackeros-snapshots/restore-backups/<config>-<id>-<czas>/
hackeros-snapshots restore 5 /etc/fstab --to /tmp/odzysk          # wypakuj obok, nic nie nadpisując
```
Opcje: `--method send|rsync`, `--deep` (porównuje zawartość sumami kontrolnymi — wolne), `--delete` (katalog dokładnie jak w snapshocie), `--no-backup`, `--porcelain`.
Bez roota diff idzie przez `rsync` i nie zobaczy plików nieczytelnych dla użytkownika.

### Wiele konfiguracji
```sh
sudo hackeros-snapshots config create home --source /home      # /home musi być subwoluminem (btrfs) albo katalogiem (ext4)
sudo hackeros-snapshots -c home init
hackeros-snapshots -c home list
sudo hackeros-snapshots cleanup --all
```
Pliki: `config.hk` = `root` (tu też globalne: `grub`, `notify_level`, `log_file`), `configs.d/<nazwa>.hk` = reszta.
**Wykluczenia** (`excludes=/var/log,/var/cache`): ext4 → `rsync --exclude`; btrfs → ścieżki są wycinane z zapisywalnej kopii, która potem dostaje `ro` (można to zrobić „za darmo”, robiąc z katalogu zagnieżdżony subwolumin). Przy rollbacku roota wykluczone ścieżki są przenoszone ze starego rootu (`cp --reflink`), więc nie znikają.

### Kopie zewnętrzne (offsite)
```sh
sudo hackeros-snapshots config apply offsite=true offsite_target=root@nas:/backups/hsnap offsite_types=manual,boot
sudo hackeros-snapshots offsite test | run | prune | status
```
btrfs: przyrostowy `btrfs send -p <poprzedni skopiowany> | btrfs receive` (cel musi być btrfs; przez SSH potrzebny root na zdalnej maszynie i klucz). ext4: `rsync --link-dest`. Na celu: `<cel>/<config>/<id>/snapshot`. `offsite_keep` = ile kopii zostaje. Odzyskiwanie: `btrfs send | btrfs receive` w drugą stronę (albo rsync) — ręcznie.

### Powiadomienia, log, tray
`notify_level`: `off` / `errors` (domyślnie) / `all`. Błąd snapshotu, brak miejsca, nieudana kopia zewnętrzna → `notify-send` do każdej zalogowanej sesji + `journalctl -t hackeros-snapshots` + `/var/log/hackeros-snapshots.log` (sam się obraca przy 1 MB).
`hackeros-snapshots tray` (autostart po instalacji, wymaga `yad`): ikona pokazuje stan (dysk / ostrzeżenie / błąd), podpowiedź liczbę snapshotów, menu: otwórz GUI, zrób snapshot, posprzątaj. Stan zapisuje demon w `/run/hackeros-snapshots/status`.

## GUI (Silver 0.2 + TypeScript + Solid.js)

Zakładki: **Dashboard** (liczby, zajęte miejsce, wykres typów, stan usługi, ostatnie zadania), **Snapshots** (wyszukiwarka, filtr typu, sortowanie, rozmiary, zaznaczanie wielu → porównaj / usuń, tworzenie z wyborem typu, podgląd sprzątania `--dry-run`), **Diff** (filtry rodzaju zmian i ścieżki, eksport listy, przywracanie pliku z A lub B), **Browse** (okruszki, filtr, przywracanie na miejsce albo do wybranego katalogu `--to`), **Settings** (formularz ze zmianami „do zapisania”, walidacja liczb), **Offsite**, **Activity** (historia zadań z pełnym wyjściem, kopiowanie do schowka), **Setup** (kreator). Skróty: `Ctrl+R` odśwież, `Alt+1…8` zakładki. Ostatnia zakładka, config i filtry są zapamiętywane w `~/.config/hackeros-snapshots/gui.json`.

Wszystko, co wymaga roota, działa jako **zadanie w tle** (`app::spawn_task` → `pkexec hackeros-snapshots …`), więc okno nie zamiera. GUI używa **stockowego** Silvera ^0.2 (komendy JSON + `silver.invoke`, `on_tick`, `spawn_task`) — łatka `vendor/silver-hsnap.patch` nie jest już potrzebna. Szczegóły i uruchamianie testów: `gui/README.md`.

## Konfiguracja

Format `.hk`: `! komentarz`, `[sekcja]`, `-> klucz => wartość`. Domyślny plik: `data/config.hk` (generowany ze schematu w `src/config.h#` — nowy klucz to jedna linia tam). `hackeros-snapshots config keys` wypisuje wszystkie.

## Struktura repozytorium

```
src/       CLI + demon (H#): main cli config snap store retention usage manager diff roots offsite grub setup daemon tray notify fsinfo paths util ui
gui/       GUI: src/ (main backend — H#), frontend/ (TypeScript + Solid.js: src/, style.css, build.mjs), tests/ (runner QuickJS)
data/      unit systemd, hook GRUB, restore-init, hook apt, polkit, skrypty awk (diff), config.hk, .desktop (GUI, tray)
tests/     run.sh — testy parserów diffa i przywracania (sh, awk, rsync)
packaging/ install.sh, uninstall.sh
```

## Ograniczenia

- **Niesprawdzone kompilatorem ani na btrfs/GRUB** (patrz status wyżej). Składnia H# opiera się na kodzie `bit` v0.0.1 i README H# v0.9.
- btrfs: wymagany układ z subwoluminem root (`@`); przy `/` = top-level rollback jest odrzucany. `btrfs send` w diffie wymaga, by oba snapshoty były potomkami tego samego subwolumina (tak jest) — inaczej program spada do `rsync`.
- ext4: snapshoty i dane są na jednej partycji → to nie backup (użyj offsite). `max_usage_percent` liczone `du` jest wolne (nice/ionice idle), robi się przy starcie i `cleanup`, nie co godzinę.
- Wykluczenia btrfs kosztują usunięcie referencji z kopii przy każdym snapshocie (metadane, nie dane) — dla ogromnych katalogów lepszy zagnieżdżony subwolumin.
- Kopia zewnętrzna: pierwsze wysłanie jest pełne (cały root); odzyskiwanie z niej jest ręczne.
- Rollback `home` (i innych configów) robi `rsync --delete` na żywym katalogu — zamknij programy, które go używają.
- Ikona w trayu zależy od `yad`; bez niego zostają same powiadomienia.
- GUI: dialogi potwierdzeń wymagają shimu `tinyfiledialogs` Silvera; wpisane pole można wyczyścić tylko wpisując `-`.
- Restore z GRUB-a bez `/boot` w snapshocie i bez tej wersji w `/boot` użyje najnowszego jądra.

## Testowanie (VM)

1. `sh tests/run.sh` — parsery i przywracanie (bez toolchaina).
2. VM z btrfs (`@`, `@home`) **i** druga z ext4, HackerOS/Debian z GRUB-em; `bit && sudo ./packaging/install.sh && sudo hackeros-snapshots init`.
3. `create`, zmień/usuń plik, `diff <id>`, `restore <id> /ścieżka`; `rollback <id>` + reboot; `roots list`.
4. `sudo update-grub`, w GRUB-ie `HackerOS Snapshots → Restore: snapshot #N` (sprawdź, że jądro się zgadza: `uname -r`).
5. `config set keep_boot 1` i kilka restartów → został jeden snapshot `boot`; `config set min_free_percent 90` → snapshot odmówiony + powiadomienie.
6. `config create home --source /home`, `-c home init`, `offsite test` na drugim dysku (btrfs) / przez SSH.

## Licencja

GPL-3.0 — patrz `LICENSE`.
