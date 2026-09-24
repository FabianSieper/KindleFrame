# WatchThis usage guide

AKA CVE-2022-23224, CVE-2022-23225, CVE-2022-23226 - full writeup with technical details to be released after 5.14.3 has been widely rolled out.

Thank you to NiLuJe, yparitcher and darkassassinua for adding KOReader support for PW5, repackaging all of the hacks and testing this jailbreak

This vulnerability is released in good faith and in the hope that other security researchers will utilise the access that it provides to assist Amazon/Lab126 in improving their security posture.

If you're concerned about the security of your device and do not wish to jailbreak, install firmware version 5.14.3 from this link - I've been working with Amazon to create a fix and can confirm that this version has been hardened against this vulnerability.

Additional thanks to everyone at Amazon/Lab126 who contributed towards this .

Finally, I encourage Amazon/Lab126 to provide a method of unlocking their devices that doesn't involve the need of a 0-day, both for security researchers and for technical users who are interested in modifying their devices. We know that your employees lurk here, use tools that we've created internally and that our ideas have been implemented by you more than once, so help us help you - I promise that we don't bite ;)

This jailbreak is compatible with Kindle devices running the following firmware versions:

**KT3, KT4, KOA1, KOA2, KOA3, PW3, PW4, PW5**:
5.14.2
5.14.1 (5.14.1.1 on PW5)
5.13.7
5.13.6
5.13.5
5.13.4

**KV:**
5.13.6
5.13.5
5.13.4

**KT2, PW2**:
5.12.2.2

You **must** use the exploit payload that matches your device/firmware combination exactly.

--- 

## Setup
- Factory reset the device. **Make sure to use the "en_GB" or "English (United Kingdom)" locale when setting the language.**
- Type `;enter_demo` in the Kindle search bar after performing a factory reset
- Reboot the device
- Once in demo mode, skip setting up wifi and enter dummy values for store registration when prompted
- Skip searching for a demo payload
- Select the "standard" demo type
- Press "Done" at the prompt to sideload content. **Do not sideload the jailbreak at this stage.**
- Once the demo is setup, skip the misconfiguration lockout using the "secret gesture" (double finger tap on bottom right of screen then swipe left)
- Enter the demo configuration menu by typing `;demo` into the search bar
- Select the "Sideload Content" option

## Jailbreak
- Connect the device to a PC and:
- Create the directory `.demo` at the root of the Kindle storage
- Copy `${YOUR_DEVICE}-${YOUR_FW_VERSION}.zip` to `.demo/`
  - Copy `demo.json` to  `.demo/`
  - Create an empty folder at `.demo/goodreads`
- Press "Done" at the prompt to install the jailbreak script
- Exit the demo menu and either enter `;dsts` or swipe down and select the settings icon to enter the device settings menu
  - If an application error occurs, hard reboot the device by holding the power button, enter the demo menu again and select `Sideload Content -> Done` once more _without_ connecting to USB
- Select "Help & User Guides" then "Get started"
- If jailbreaking KT2 or PW2, select the store button instead
- The device will reboot
- The jailbreak script will run during the next boot

## Post-jailbreak
- After the device has rebooted, type `;uzb` into the search bar
- Connect the device to a PC and:
  - Copy `Update_hotfix_watchthis_custom.bin` to `/mnt/us`
- Eject the device and either enter `;dsts` or swipe down and select the settings icon to enter the device settings menu
- Select Update Your Kindle to install the custom hotfix
- This will take your device out of demo mode, rebuild the application registry and clean up unneeded jailbreak files.

--- 

## Troubleshooting
- Alternative Demo Mode entry method:
  - Create an empty file named DONT_CHECK_BATTERY at the root of the Kindle USB storage
  - Activate demo mode by typing ;demo into the search bar
  - Once in demo mode, skip setting up wifi and enter dummy values for store registration when prompted
- If you need to reset your device whilst in Demo Mode, enter ;uzb in the search bar to enable USB storage mode then create an empty file named "DO_FACTORY_RESTORE" at the root of the Kindle storage. Once this has been created, reboot the device.

---
VERSION: R2
