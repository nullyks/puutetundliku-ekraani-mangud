# Puuteekraani ühendamine ja mitmikpuute seadistamine

Kahe mängijaga mäng vajab vähemalt kaht samaaegset, sõltumatult jälgitavat puutekontakti. Alusta Chromiumi katsest. Seejärel kontrolli Linuxi sisendit ja vajaduse korral töölaua seadistust. Kui kaks sõrme juba töötavad, jätka [mängude avamisega](../README.md#alusta-raspberry-pi-s).

## Katses kasutatud ekraan ja ühendused

| Osa | Katseseadistus |
| --- | --- |
| Arvuti ja töölaud | Raspberry Pi 400, Raspberry Pi OS Desktop (Debian 13 Trixie), Wayland ja labwc. |
| Ekraan | 7-tolline 1024 × 600 mahtuvuslik IPS-paneel, mille trükiplaadil on kiri **7inch LCD Display-D**. Pi kuvaväljund näitab mudelit **MPI7010**. [Ekraani andmed](https://www.lcdwiki.com/7inch_HDMI_Display-D) |
| Pilt | Pi micro-HDMI väljundist ekraani HDMI-sisendisse. Katse-Pi väljund on `HDMI-A-1`. |
| Puude ja ekraani toide | Pi USB-A pesast ekraani `Touch&Power` USB-C pessa andmesidet toetava kaabliga. |
| Puutekontroller | Linuxi sisendseadme nimi on `QDtech MPI5001`, USB tunnus `0484:5750`. Katse-Pi labwc kirjes on nimi `QDtech MPI5001 (USB 1-1.3)`. |

Pildi olemasolu kinnitab HDMI ühendust. Puute jaoks kontrolli eraldi USB-andmesidet. Kui ekraan süttib, aga Linux ei näe puuteseadet, proovi teist andmesidekaablit ning ühenda see katseks otse Pi USB-pessa.

## 1. Kinnita kaks kontakti Chromiumis

Ava Pi **töölaua terminal** ja käivita allolevad käsud pärast [repo allalaadimist](../README.md#alusta-raspberry-pi-s). Test toimub Pi enda puuteekraanil. Raspberry Pi Connecti ekraanijagamine sobib kuva jälgimiseks. Testi sisend anna kahe päris sõrmega ekraanil.

```bash
cd ~/puutetundliku-ekraani-mangud
chromium "file://$PWD/puutetest.html"
```

1. Vajadusel vajuta `F11`, et testala täidaks ekraani. Klõpsa või puuduta testala sees, brauseri tööriistaribast eemal.
2. Aseta üks sõrm vasaku serva lähedale ja hoia seda paigal. Aseta teine parema serva lähedale. Liiguta korraga mõlemat. Oodatav tulemus on kaks värvilist ringi, **Viimane sisend** `touch` ja **Aktiivseid puuteid** `2`.
3. Tõsta üks sõrm ja liiguta teist edasi. Aktiivseid puuteid peab jääma üks ja selle ring peab sõrme jälgima. Aseta esimene sõrm tagasi. Nüüd peab aktiivseid puuteid olema jälle kaks.
4. Tõsta mõlemad sõrmed. **Aktiivseid puuteid** peab näitama `0` ning **Suurim korraga** vähemalt `2`. Lähtestamiseks laadi leht klahvidega `Ctrl+R` uuesti.

Testleht kuvab nii Pointer Events kui ka vajadusel Touch Events sündmusi. Kui testleht näeb kaht puudet, aga mängus töötab ainult üks kontakt, kontrolli mängus režiimi **Kahekesi**. Pongi ja Õhuhoki lohistamised peavad algama eri väljakupooltelt. Lennujuhis peavad lohistamised algama kahelt sobiva värvi ootel laevalt. Vajadusel kontrolli Chromiumi arendajakonsoolis otse mängudes kasutatavaid Pointer Events sündmusi. Käivita järgmine rida testlehe konsoolis, jäta brauseri seadmeemulatsioon välja ning puuduta lehte kahe sõrmega. Konsoolis peab ilmuma kaks `touch` kirjet eri ID-dega.

```js
document.querySelector('#surface').addEventListener('pointerdown', ({ pointerType, pointerId }) => console.log(pointerType, pointerId));
```

## 2. Selgita välja, mida Linux näeb

Kui testleht kuvab ainult hiirt, ühe puute või ei reageeri, kontrolli puuteseadet `libinput`-iga. Diagnostikaks sobib ka Raspberry Pi Connecti **Remote shell**. Kasuta `sudo` parooliküsimuse korral Pi kohalikku kasutajaparooli. [Libinputi diagnostika](https://wayland.freedesktop.org/libinput/doc/latest/tools.html)

Kui `libinput` puudub, paigalda see Raspberry Pi OS-is.

```bash
sudo apt update
sudo apt install libinput-tools
```

1. Kuva seadmete loend.

   ```bash
   sudo libinput list-devices
   ```

   Leia puutekontroller ja kirjuta üles selle ploki **Device**, **Kernel** ning **Capabilities**. Otsi võimekust `touch`. Mõni kontroller näitab samas loendis ka hiireliidest, mille võimekus on `pointer`. Testiks vali puuteliidese `/dev/input/eventN`. Sündmusfaili number võib pärast taaskäivitust või USB-pesa vahetust muutuda.
2. Kuula ainult valitud seadet. Asenda allolev `event5` oma loendist leitud väärtusega. Kui seadme kirje on ebaselge, kasuta esmalt `sudo libinput debug-events` ja vaata, milline seade ekraani puudutamisel reageerib.

   ```bash
   sudo libinput debug-events --device /dev/input/event5
   ```

3. Hoia üht sõrme ekraanil, lisa teine, liiguta mõlemat ja tõsta üks sõrm üles. Lõpeta logimine klahvidega `Ctrl+C`. Kahe kontakti kinnitavad **sama seadme kaks eri kontakti `TOUCH_DOWN` enne esimest `TOUCH_UP`**. Kui üks kontakt lõpeb, peaks teise sõrme liigutamine jätkuvalt andma `TOUCH_MOTION`.

Lihtsustatud näites on jäetud alles sündmusfail, sündmuse liik ja kontakti number.

```text
event5  TOUCH_DOWN    kontakt 0
event5  TOUCH_DOWN    kontakt 1
event5  TOUCH_UP      kontakt 1
event5  TOUCH_MOTION  kontakt 0
event5  TOUCH_UP      kontakt 0
```

| Tulemus | Järgmine samm |
| --- | --- |
| Linuxis kaks kontakti, Chromiumis `mouse` või üks kontakt | Kontrolli töölauaseanssi ning [labwc mitmikpuute seadistust](#3-luba-mitmikpuude-labwc-s). |
| Linuxis ainult üks aktiivne kontakt | Kontrolli mudeli mitmikpuute tuge, puutekontrolleri režiimi ja vajadusel kerneli toorsündmusi. [Teiste ekraanide tegevused](#teiste-ekraanide-tegevused) |
| Ekraani puudutus annab ainult `POINTER_MOTION` või `POINTER_BUTTON` | Otsi sama kontrolleri kõrval puuteliidest. Kui kontroller ilmub ainult hiirena, kontrolli tootja juhendist seadme töörežiimi ja Linuxi draiverit. [Teiste ekraanide tegevused](#teiste-ekraanide-tegevused) |
| Seadet või puutesündmusi pole | Kontrolli toidet, USB-andmesidet ja seadme tuvastamist. [Teiste ekraanide tegevused](#teiste-ekraanide-tegevused) |
| Kaks kontakti on näha, aga valel ekraanil või vales kohas | Seo puuteseade õige videoväljundiga ja kontrolli ekraani orientatsiooni. [Teiste ekraanide tegevused](#teiste-ekraanide-tegevused) |

## 3. Luba mitmikpuude labwc-s

Tuvasta töölauaseanss Pi **töölaua terminalis**. Kaugterminal võib näidata teistsugust või tühja seansitüüpi.

```bash
printf 'Seansi tüüp: %s\n' "${XDG_SESSION_TYPE:-teadmata}"
pgrep -u "$(id -u)" -a -x labwc
```

Kui näed `wayland` ja töötavat `labwc` protsessi, kasuta üht järgmistest viisidest. Katse-Pi algseisus nägi Linux kaht kontakti, kuid Chromiumis oli viimane sisend `mouse`. Puuteseadme `mouseEmulation` väärtuse muutmine `yes` pealt `no` peale andis Chromiumis kaks eraldi puutepunkti. [Labwc puuteseaded](https://github.com/raspberrypi-ui/labwc-latest/blob/master/docs/labwc-config.5.scd#touch)

### Graafilise menüü kaudu

1. Ava Raspberry Pi OS Trixie töölaual **Preferences → Control Centre → Screens**. Mõnel vanemal Raspberry Pi OS-il on eraldi **Screen Configuration** rakendus. [Raspberry Pi ekraaniseaded](https://www.raspberrypi.com/documentation/computers/configuration.html#configure-display-settings)
2. Tee oma puuteekraani kujutisel paremklõps või vali ekraan rippmenüüst **Screens**. Ava **Touchscreen**, vali õige puuteseade ning vali **Mode → Multitouch**. Vali **Apply** ja kinnita muudatus. Kui **Mode** või soovitud seade menüüs puudub, kasuta failipõhist varianti. [Raspberry Pi ekraaniseadete puutemenüü](https://github.com/raspberrypi-ui/raindrop/blob/master/src/raindrop.c)
3. Korda kahe sõrme katset Chromiumis. Tagasipööramiseks vali sama seadme menüüst eelmine režiim.

### Seadistusfaili kaudu

1. Vaata töölaua terminalis, millise nimega väljund on puuteekraaniga ühendatud. Loe `wlr-randr` väljundist aktiivne ühendus ja võrdle ekraani mudelit. Väljund võib olla näiteks `HDMI-A-1`, `HDMI-A-2` või `DSI-1`.

   ```bash
   wlr-randr
   ```

2. Tee kasutaja labwc seadistusfailist koopia ning ava see muutmiseks samas terminalis. Kui fail puudub, alustab käsk tavalisest süsteemi seadistusfailist, kui see on olemas.

   ```bash
   config_dir="${XDG_CONFIG_HOME:-$HOME/.config}/labwc"
   config="$config_dir/rc.xml"
   mkdir -p -- "$config_dir" &&
   if [ -f "$config" ]; then
     backup="$config.bak-$(date +%Y%m%d-%H%M%S)"
     cp -p -- "$config" "$backup" && printf 'Varukoopia: %s\n' "$backup"
   elif [ -r /etc/xdg/labwc/rc.xml ]; then
     cp -p -- /etc/xdg/labwc/rc.xml "$config"
   fi &&
   nano "$config"
   ```

3. Leia olemasolev seadmekohane `<touch>` kirje ja muuda ainult `mouseEmulation` väärtuseks `no`. Säilita olemasolev seadmenimi täpselt, kaasa arvatud võimalik USB-pesa järelliide. Kui kirjet pole, lisa see otse faili `<labwc_config>` juurelemendi sisse. Uues tühjas failis lisa ka juurelemendi algus ja lõpp. Järgmine näide on **katse-Pi tegelik kirje**.

   ```xml
   <labwc_config>
     <touch deviceName="QDtech MPI5001 (USB 1-1.3)" mapToOutput="HDMI-A-1" mouseEmulation="no" />
   </labwc_config>
   ```

   Uue ekraani korral kasuta `libinput list-devices` näidatud **Device** nime ja `wlr-randr` näidatud videoväljundit. Kui seadmel on töölaua loodud kirje, eelista seal olevat nime. Pärast USB- või HDMI-pesa vahetust kontrolli nime ja väljundit uuesti. Kasuta ühe seadme kohta üht kirjet. Tühi `deviceName` võib rakendada sätte kõigile puuteseadmetele. [Labwc konfiguratsioonifail](https://github.com/raspberrypi-ui/labwc-latest/blob/master/docs/labwc-config.5.scd)
4. Salvesta `nano`-s klahvidega `Ctrl+O` ja `Enter`, seejärel välju klahvidega `Ctrl+X`. Laadi seaded uuesti tavalise töölauakasutajana.

   ```bash
   labwc --reconfigure
   ```

5. Laadi puutetest uuesti. Kui sisend on endiselt `mouse`, kontrolli esmalt seadmenime, väljundit ja XML-i paigutust ning proovi töölaualt välja ja uuesti sisse logida. Kui Linux näeb kaht kontakti ja ainult Chromiumis püsib tõrge, sulge Chromium menüüst ning käivita see Waylandi seansis alloleva käsuga. Juba töötav protsess võib uue akna avada vanade käivitusseadetega. [Chromiumi Waylandi käivitusvalik](https://chromium.googlesource.com/chromium/src/+/main/docs/ozone_overview.md#wayland)

   ```bash
   cd ~/puutetundliku-ekraani-mangud
   chromium --ozone-platform=wayland "file://$PWD/puutetest.html"
   ```

Failimuudatuse tagasipööramiseks kopeeri salvestatud varufail tagasi `rc.xml` asemele. Kui muudad ja taastad faili samas terminalis, saad kasutada allolevat käsku. Uues terminalis kasuta varukoopia ja seadistusfaili täielikke failiteid.

```bash
cp -p -- "$backup" "$config" && labwc --reconfigure
```

Kui kasutajafail loodi selle katse jaoks, nimeta see näiteks `rc.xml.puutekatse`-ks ning laadi seaded uuesti. Labwc saab seejärel kasutada süsteemi seadistusfaili.

## Teiste ekraanide tegevused

### Tuvasta ekraani ühendusviis

| Ekraani tüüp | Mida kontrollida |
| --- | --- |
| **HDMI + USB HID** | Ühenda video ja USB-andmeside. USB-puutekontroller peaks ilmuma käsu `lsusb` väljundis ning selle puuteliides `libinput list-devices` loendis. Mõnel mudelil on toite ja puute jaoks eri USB-pesad. Käivita kahe sõrme katse enne draiveri paigaldamist. |
| **USB-C video ja puutega monitor** | Kontrolli, kas monitoril on Pi 400 jaoks HDMI-sisend ja eraldi USB-andmeside võimalus. Pi 400 USB-C pesa on toitesisend. Pi 400 pilt väljub micro-HDMI kaudu. [Raspberry Pi 400 tehnilised andmed](https://www.raspberrypi.com/products/raspberry-pi-400/) |
| **DSI, näiteks Raspberry Pi Touch Display või Touch Display 2** | Pi 400-l puudub DSI-pesa. DSI-ekraani katsetamiseks kasuta sobivat Raspberry Pi mudelit ja selle ekraani ühendusjuhendit. [Touch Display ühilduvus](https://www.raspberrypi.com/documentation/accessories/display.html#compatibility) · [Touch Display 2 ühilduvus](https://www.raspberrypi.com/documentation/accessories/touch-display-2.html#compatibility) |
| **SPI- või GPIO-ekraan eraldi puutekontrolleriga** | Kontrolli täpset mudelit ja plaadirevisjoni. Pildi ja puute jaoks võib vaja minna eri operatsioonisüsteemi draivereid või Device Tree ülekatteid. Kasuta tootja juhendit just oma Pi mudeli ja OS-i versiooni jaoks. Kui kontroller edastab ainult ühe kontakti, saab mängida üksi või kasutada mängus toetatud klaviatuurijuhtimist. |

### Kui Linux ei tuvasta puuteseadet või näeb ainult üht kontakti

1. Käivita USB-ekraani puhul `lsusb` enne kaabli ühendamist ja uuesti pärast ühendamist. Vajadusel paigalda `usbutils` käsuga `sudo apt install usbutils`. Kui uut seadet ei ilmu, proovi teist USB-andmesidekaablit ja porti. Eraldi toitepesaga mudeli puhul kontrolli ka toidet tootja juhendi järgi.
2. Kui USB-seade ilmub, leia selle puuteliidese sündmusfail käsuga `sudo libinput list-devices` või kerneli seadmeloendist `cat /proc/bus/input/devices`. Vaata õige sündmusfaili omadusi. `ID_INPUT_TOUCHSCREEN=1` näitab, et udev on liidese puuteekraaniks liigitanud. Kontaktide arvu kinnitab kahe sõrme katse.

   ```bash
   udevadm info --query=property --name=/dev/input/event5
   ```

3. Kui libinputis puudub puuteliides või see näeb ainult üht kontakti, vaata kerneli toorsündmusi. Vajadusel paigalda `sudo apt install evtest`. Asenda `event5` uuesti konkreetse seadme failiga ja korda sama kahe sõrme katset.

   ```bash
   sudo evtest /dev/input/event5
   ```

   Tänapäevase Type B mitmikpuute korral otsi `ABS_MT_SLOT` ja `ABS_MT_TRACKING_ID` sündmusi. Kaks aktiivset pesa peavad saama eri kontaktitunnused enne, kui kumbki kontakt lõpeb. Kontakt lõpeb vastava pesa `ABS_MT_TRACKING_ID` väärtusega `-1`. Kui kernel näeb mõlemat, aga libinput ainult üht, kontrolli seadme liigitust ja otsi kontrolleri USB tunnuse ning OS-i järgi teadaolevat libinputi või draiveri tuge. [Linuxi mitmikpuute protokoll](https://www.kernel.org/doc/html/latest/input/multi-touch-protocol.html)
4. Kui ka kernel saab ühe kontakti, kontrolli tootja andmetest sama mudeli ja plaadirevisjoni samaaegsete kontaktide arvu Linuxis. Kui tootja pakub puute- ja hiirerežiimi vahetamist või mudelipõhist draiverit, järgi selle mudeli juhendit ja korda katset. Ainult üht kontakti edastava kontrolleri korral ei saa labwc teisest sõrmest sõltumatut kontakti tuletada.

### Kui kontakt läheb valele kuvale või koordinaadid on nihkes

- **Wayland ja labwc.** Kontrolli `wlr-randr` abil väljundit ja vali õige puuteseade ekraaniseadetes või sea `mapToOutput` failis. Korda katset kõigis neljas nurgas ja seejärel kahe sõrmega. Kui pilt on pööratud, seo esmalt puude õige väljundiga. Kui koordinaadid on pärast seda endiselt pööratud või nihkes, järgi oma töölaua või kontrolleri kalibreerimisjuhist. Seadmepõhine libinputi kalibreerimine võib kasutada udev omadust `LIBINPUT_CALIBRATION_MATRIX`. Maatriks peab vastama just sinu paigutusele. [Libinputi kalibreerimine](https://wayland.freedesktop.org/libinput/doc/latest/absolute-axes.html#calibration-of-absolute-devices)
- **Muu Waylandi töölaud.** Kasuta selle töölaua puuteekraani seadistust. Näiteks Sway seob puuteseadme väljundiga valikuga `map_to_output`. [Sway sisendiseaded](https://manpages.debian.org/trixie/sway/sway-input.5.en.html)
- **X11.** Kui töölaua terminal näitab `XDG_SESSION_TYPE=x11`, kuva seadmed käsuga `xinput list` ja ühendused käsuga `xrandr --query`. Seo õige seade väljundiga käsuga `xinput map-to-output SEADME_ID VÄLJUNDI_NIMI`, asendades mõlemad väärtused oma loendist. Korda katset. See seos kehtib jooksvas X11 seansis. [XInputi juhend](https://manpages.debian.org/trixie/xinput/xinput.1.en.html)

## Diagnostikaraport ja tagasiside

Repo [diagnostikaskript](../puutediagnostika.sh) salvestab kohaliku raporti. Katse kestab 15 sekundit ja raportisse lähevad süsteemiversioon, seadmeinfo ning valitud sisendsündmused. Käivita skript ja korda kahe sõrme katset.

```bash
cd ~/puutetundliku-ekraani-mangud
bash puutediagnostika.sh
```

Skript kuvab raporti ja selle asukoha. Vaikimisi on fail `~/.local/state/puutetundliku-ekraani-mangud/puutediagnostika.md`. Lisa tagasisidesse ekraani mudel, ühendusviis, brauseri **Viimane sisend** ja **Suurim korraga**, Linuxis nähtud kontaktide arv ning kas probleem püsis ka pärast seadistamist.

Kui tahad saata kohaliku raporti avalikku GitHubi issue'sse, vaata selle sisu enne saatmist üle ja paigalda vajadusel `gh` käsuga `sudo apt install gh`. GitHub CLI autentimise kinnituse saad teha ka teise arvuti brauseris GitHubi näidatud URL-i ja ühekordse koodiga. [GitHub CLI autentimine](https://cli.github.com/manual/gh_auth_login)

```bash
gh auth login --hostname github.com --web
bash puutediagnostika.sh --saada
```

Saatmiskäsk loob **avaliku GitHubi issue**. Kui Pi-sse GitHubi autentimist seadistada ei soovi, vaata raportit **Remote shell** kaudu ja lisa vajalik väljavõte [uude issue'sse](https://github.com/nullyks/puutetundliku-ekraani-mangud/issues/new) arvutist, kus oled juba sisse loginud.
