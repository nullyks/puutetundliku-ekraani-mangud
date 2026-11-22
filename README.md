# Puutetundliku ekraani mängud

Projekti eesmärk on katsetada lihtsaid puutemänge Raspberry Pi 400 ja 7-tollise ekraaniga. **Pong** on retrostiilis reketimäng ning **Õhuhoki** on neoonvärvides küberpungi stiilis litrimäng. Mõlemas saab mängida arvuti või teise inimese vastu.

## Käivitamine Raspberry Pi-s

Ühenda ekraan Pi-ga HDMI kaudu. Puuteandmete ja ekraani toite jaoks ühenda Pi USB-A pesa ekraani `Touch&Power` pesaga andmesidet toetava USB-A–USB-C kaabliga. Katses kasutatud 7-tollise IPS-paneeli lahutus on 1024 × 600. [Ekraani andmed](https://www.lcdwiki.com/7inch_HDMI_Display-D)

Klooni repo Pi terminalis esimesel korral. Avalikust repost saab mängu alla laadida ilma GitHubi kontota.

```bash
cd ~
git clone https://github.com/nullyks/puutetundliku-ekraani-mangud.git
cd puutetundliku-ekraani-mangud
chromium "$PWD/index.html"
```

Kui repo on juba olemas, tõmba mängu värske versioon järgmise käsuga. Kui mäng on Chromiumis avatud, laadi leht klahvidega `Ctrl+R` uuesti.

```bash
git -C ~/puutetundliku-ekraani-mangud pull --ff-only
```

Pongi avab `index.html`, õhuhoki avab `air-hockey.html`. Mõlemal lehel saab valida ka teise mängu. Pärast failide allalaadimist piisab mängimiseks Chromiumist ja internetiühendust pole vaja. Pi arenduskatses oli kasutusel Raspberry Pi OS Desktop (Debian 13 Trixie), Waylandi töölaud labwc-ga ja Chromium 154.

## Õhuhoki

### Käivitamine ja mängimine

Vali Pongi lehel **Õhuhoki** või käivita Pi terminalis järgmised käsud.

```bash
cd ~/puutetundliku-ekraani-mangud
chromium "$PWD/air-hockey.html"
```

| Režiim | Puutega | Klaviatuuriga |
| --- | --- | --- |
| **Üksinda** | Juhi vasakut, tsüaansinist löögiketast. Roosat ketast juhib arvuti. | Vasakut ketast juhivad `WASD` või nooleklahvid. |
| **Kahekesi** | Kumbki mängija lohistab sõrme oma väljakupoolel. Mõlemad kettad liiguvad korraga. | Vasakut ketast juhivad `WASD`, paremat nooleklahvid. |

- Löögiketas liigub nii piki- kui ka põikisuunas. Sõrm juhib sama ketast kuni tõstmiseni ka siis, kui sõrm liigub üle keskjoone. Ketas jääb oma poolele.
- Löögiketta kiirus ja suund mõjutavad litri põrget. Värav läheb kirja, kui litter on tervenisti väravajoone ületanud. Järgmine serv suundub värava sisse lasknud mängija poole. Võidab esimene, kes lööb **7 väravat**.
- **Paus** või `Esc` peatab mängu. Pausimenüüst saab mängu jätkata või režiimivalikusse naasta. Pärast võitu alustab **Uus mäng** sama režiimiga uuesti. Täisekraani avab `⛶` või `F11`.

### Õhuhoki arendus ja ülesehitus

1. **Kahe teljega juhtimine.** Nagu Pongis, määrab lohistamise alguspool, kumba ketast sõrm juhib. Õhuhokis määravad sõrme mõlemad koordinaadid ketta sihi ja ketta liikumiskiirus mõjutab löögi tugevust.
2. **Litter ja vastane.** Füüsika töötab 1/120 sekundi sammuga. Litter põrkab poordilt ja väravapostidelt ning aeglustub väljakul. Arvuti kaitseb väravat, kui litter liigub tema poole kiiresti, ja otsib löögiasendit, kui litter on tema väljakupoolel. Neoonvärvides väljak on joonistatud HTML Canvasel.
3. **Esimene seadmekatse.** Avaldasime mängu GitHubi `main` harus ja tõmbasime selle Pi 400-sse Raspberry Pi Connecti kaudu. Pi Chromiumis kontrollisime mõlemat mängurežiimi, kahe puute sõltumatut juhtimist, arvutivastase lööki ja väravaid. Kahe mängija mängu proovisime ka füüsilisel ekraanil. [Esimene demoversioon](https://github.com/nullyks/puutetundliku-ekraani-mangud/commit/8dfa336)
4. **Nurgavea parandus.** Seadmekatsel jäi litter väljaku nurka kinni. Ümardasime kõik neli nurka nii joonisel kui ka füüsikas. Kui löögiketas surub litri vastu kaarjat poordi, pääseb litter liikuma piki kaart. Kontrollisime Pi Chromiumis kõigi nelja nurga põrkeid ja litri vabanemist. [Ümarnurkade parandus](https://github.com/nullyks/puutetundliku-ekraani-mangud/commit/02be7bf)

| Fail | Ülesanne |
| --- | --- |
| [`air-hockey.html`](air-hockey.html), [`air-hockey.css`](air-hockey.css) | Mänguleht, menüüd, punktiseis ja küberpungi stiilis kujundus. |
| [`air-hockey.js`](air-hockey.js) | Väljaku joonistamine, puute- ja klaviatuurisisend ning mängu olekud. |
| [`air-hockey-engine.js`](air-hockey-engine.js) | Ketaste liikumine, litri põrked, serv, väravad ja arvutivastane. |
| [`air-hockey-engine.test.cjs`](air-hockey-engine.test.cjs) | Füüsika ja mängureeglite automaattestid. |

### Õhuhoki testimine

Käivita arendusarvutis repo kaustas õhuhoki üheksa loogikatesti. Käsuga `node --test` käivituvad ka Pongi testid.

```bash
node --test air-hockey-engine.test.cjs
```

Pärast mängu uuendamist kontrolli Pi enda puuteekraanil neid olukordi.

1. Vali **Kahekesi** ning lohista mõlemat ketast korraga eri suundades. Tõsta üks sõrm ja veendu, et teise mängija ketas liigub edasi.
2. Suuna litter järjest eri nurkadesse. Litter peab kaarelt väljakule põrkama. Proovi seda ka löögikettaga vastu nurka surudes ja kontrolli, et litter pääseks kaare suunas liikuma.
3. Vali **Üksinda** ja löö litter arvuti poolele. Kontrolli arvutivastase liikumist ja tagasilööki ning seda, et värav lisaks ühe punkti.

## Pongi mängujuhend

| Režiim | Puutega | Klaviatuuriga |
| --- | --- | --- |
| **Üksinda** | Lohista sõrme väljaku vasakul poolel. Oranži reketit juhib arvuti. | Vasakut reketit juhivad `W` ja `S` või `↑` ja `↓`. |
| **Kahekesi** | Kumbki mängija alustab lohistamist oma väljakupoolel. Mõlemad saavad mängida samal ajal. | Vasakut reketit juhivad `W` ja `S`, paremat `↑` ja `↓`. |

- Reket liigub üles ja alla. Sõrm juhib sama reketit kuni tõstmiseni ka siis, kui see liigub üle keskjoone. Sõrme tõstmisel jääb reket paigale.
- Kui pall läheb vastase reketist mööda ja väljub väljaku otsast, saad punkti. Mäng jätkub uue serviga, kuni üks mängija jõuab **7 punktini** ja võidab.
- Vajuta **Paus** või `Esc`, et mäng peatada. Pausimenüüst saad jätkata või naasta režiimivalikusse. Pärast mängu saad sama režiimiga uuesti alustada.
- Täisekraani avab mängu paremas ülanurgas olev nupp või Chromiumi klahv `F11`.

## Arendusprotsess

1. **Riistvara ja mängu valik.** Esimeseks demoks valisime Pongi, sest reket liigub ühel teljel ja kummagi mängija sõrm saab jääda oma ekraanipoolele. Mängu ehitasime HTML-i, CSS-i ja JavaScriptiga, et sama versiooni saaks avada nii arendusarvutis kui Pi-s.
2. **Puutetesti loomine.** `puutetest.html` märgib iga aktiivse puute värvilise ringiga. Kui Chromium näitas sõrme hiirena, lisasime testile sisenditüübi näidu ja tegime Raspberry Pi Connecti kaugterminalis `libinput`-i katse.
3. **Hiireemulatsiooni tuvastamine.** Linuxi logis ilmusid samalt puuteseadmelt kaks `TOUCH_DOWN` sündmust enne esimest `TOUCH_UP` sündmust. Labwc seadistuses oli sellel ekraanil `mouseEmulation="yes"`. Lülitasime emulatsiooni ainult selle seadme jaoks välja ja kontrollisime, et Chromium näeb korraga kaht puudet. [Labwc puuteseaded](https://github.com/raspberrypi-ui/labwc-latest/blob/master/docs/labwc-config.5.scd#touch)
4. **Mängu rakendamine.** Lisasime palli ja reketite füüsika, punktiarvestuse, arvutivastase, kahe mängija sisendi ning retrostiilis Canvas-väljaku ja menüüd. Mänguloogikat saab brauserist eraldi testida. Füüsika töötab fikseeritud sammuga 1/120 sekundit ja brauser joonistab väljakut `requestAnimationFrame`-iga.
5. **Avaldamine ja seadmekatse.** Pärast kohalikke teste avaldasime demo GitHubi `main` harus ja tõmbasime sama versiooni Pi-sse käsuga `git pull --ff-only`. Raspberry Pi Connecti **Remote shell** oli kasutusel käskude ja automaattesti jaoks. **Screen sharing** võimaldas kontrollida tegelikku Pi kuva. Puutekatse toimus Pi enda ekraanil. [Katsetatud demoversioon](https://github.com/nullyks/puutetundliku-ekraani-mangud/commit/c4ada50) · [Raspberry Pi Connecti juhend](https://www.raspberrypi.com/documentation/services/connect.html)

### Failid

| Fail | Ülesanne |
| --- | --- |
| [`index.html`](index.html), [`pong.css`](pong.css) | Mängu leht, menüüd, punktiseis ja retrostiilis kujundus. |
| [`pong.js`](pong.js) | Canvas-väljaku joonistamine, puute- ja klaviatuurisisend, paus ning mängurežiimide vahetamine. |
| [`pong-engine.js`](pong-engine.js) | Serv, palli ja reketite liikumine, põrked, punktid ning arvutivastane. |
| [`pong-engine.test.cjs`](pong-engine.test.cjs) | Mänguloogika automaattestid. |
| [`puutetest.html`](puutetest.html), [`puutediagnostika.sh`](puutediagnostika.sh) | Brauseri puutetest ja Linuxi puutesündmuste raport. |

## Testimine

Node.js-iga arendusarvutis käivita repo kaustas mänguloogika testid.

```bash
node --test
```

| Katse | Kontrollitud tulemus |
| --- | --- |
| **Mänguloogika** | Seitse testi läbisid. Kaetud on serv, mõlema reketi liikumine, arvutivastane, põrked, punkti andmine ja mängu lõpp. |
| **Arendusarvuti Chromium** | Emuleeritud kahe puutega töötasid mõlemad reketid eraldi. Kontrollisime ka keskjoone ületamist, ühe sõrme tõstmist, klaviatuuri, pausi ning kordusmängu. |
| **Pi 400 Chromium** | Automaattestis töötasid väljaku joonistamine, mõlemad režiimid, paus, arvutivastane, võit ja kordusmäng. Mäng käivitus Pi töölaual ja töötas ka füüsilise puuteekraaniga. |

Pärast sisendikoodi või Pi seadistuse muutmist vali Pi ekraanil **Kahekesi**, lohista korraga kaht sõrme eri väljakupooltel ning tõsta üks sõrm, jättes teise ekraanile. Allesjäänud sõrm peab saama oma reketit edasi liigutada. Seejärel kontrolli režiimis **Üksinda**, et oranž reket liiguks iseseisvalt ja punkt läheks kirja.

## Kui Chromium näitab puudet hiirena

1. Ava `puutetest.html` ja kontrolli näitu **Viimane sisend**. Kui sõrm kuvatakse `mouse`-sisendina, käivita allolev Linuxi diagnostika ja proovi ekraani kahe sõrmega. Kaks `TOUCH_DOWN` sündmust samalt seadmelt enne esimest `TOUCH_UP` sündmust kinnitavad, et Linux tuvastab mõlemad sõrmed.
2. Kui Linux näeb kaht puudet ja kasutusel on labwc, kontrolli faili `~/.config/labwc/rc.xml`. Tee failist koopia ning muuda oma puuteseadme kirjes `mouseEmulation="yes"` väärtuseks `mouseEmulation="no"`. Kasuta olemasolevat seadmenime ja väljundi nime. Katse-Pi seadistus oli järgmine.

   ```xml
   <touch deviceName="QDtech MPI5001 (USB 1-1.3)" mapToOutput="HDMI-A-1" mouseEmulation="no" />
   ```

3. Rakenda muudatus käsuga `labwc --reconfigure` ja korda Chromiumis puutetesti. Kahe sõrmega peab ilmuma kaks värvilist ringi ning **Suurim korraga** peab näitama `2`. [Labwc seadistuse uuesti laadimine](https://github.com/raspberrypi-ui/labwc-latest#3-configuration)

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
