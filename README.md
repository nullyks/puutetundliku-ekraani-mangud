# Puutetundliku ekraani mängud

Raspberry Pi 400 ja 7-tollise ekraani puutetest asub failis `puutetest.html`. Ava see Pi-s Chromiumis.

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
