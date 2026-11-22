# Puutetundliku ekraani mängud

## Pong

Ava `index.html` Chromiumis. Mäng töötab kohalikest failidest ka internetita.

```bash
chromium "$PWD/index.html"
```

- **Üksinda** mängides juhid vasakut reketit, arvuti juhib paremat.
- **Kahekesi** mängides lohistab kumbki mängija sõrme omal väljakupoolel. Klaviatuuril juhivad vasakut reketit `W` ja `S`, paremat üles- ja allanoole klahvid. Üksikmängus sobivad mõlemad klahvipaarid.
- Võidab esimene, kes saab 7 punkti. `Esc` avab pausi, `F11` lülitab Chromiumi täisekraanile.

Mänguloogika teste saab käivitada käsuga `node --test`.

## Uuendused Raspberry Pi-s

Klooni repo esimesel korral. Avalikku repot saab kloonida ka ilma GitHubi kontota.

```bash
cd ~
git clone https://github.com/nullyks/puutetundliku-ekraani-mangud.git
```

Järgmisteks katseteks mine repo kausta ja tõmba värske versioon.

```bash
cd ~/puutetundliku-ekraani-mangud
git pull --ff-only
```

## Puutetesti tulemus GitHubi

Puutepunktide eraldi kontrollimiseks ava Chromiumis `puutetest.html`.

1. Käivita repo kaustas diagnostika.

   ```bash
   bash puutediagnostika.sh
   ```

   Kui `libinput` puudub, paigalda see käsuga `sudo apt install libinput-tools`. Skript annab kahe sõrme katseks 15 sekundit ja kuvab seejärel kohaliku raporti.

2. Esimesel saatmisel logi Pi-s GitHubi sisse. Kui `gh` puudub, paigalda see käsuga `sudo apt install gh`.

   ```bash
   gh auth login --hostname github.com --web
   ```

3. Saada viimane raport samast terminalist. Lisa küsimise peale lühidalt, mida Chromium näitas, näiteks `Hiir, kahte ringi ei tekkinud`.

   ```bash
   bash puutediagnostika.sh --saada
   ```

   Käsk loob **avaliku GitHubi issue** ja väljastab lingi. Hilisemad tähelepanekud saad lisada sama issue kommentaarina. Üldise tagasiside jaoks saad ka Pi brauseris [uue issue avada](https://github.com/nullyks/puutetundliku-ekraani-mangud/issues/new).
