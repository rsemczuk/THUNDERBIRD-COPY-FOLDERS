window.onload = async () => {
  let appBackup = (<WindowApp>window.browser.extension.getBackgroundPage()).appBackup;
  document.querySelectorAll<HTMLElement>("[data-locale]").forEach(elem => {
    elem.innerText = browser.i18n.getMessage(elem.dataset.locale);
  });
  let reloadTimeInput = <HTMLInputElement>document.getElementById("reloadtime");
  let activeBackupInput = <HTMLInputElement>document.getElementById("activeBackup");
  let loadNow = <HTMLInputElement>document.getElementById("loadNow");
  let advancedSettings = <HTMLInputElement>document.getElementById("advancedSettings");

  let cfg: AppCfg = await appBackup.getCfg();

  reloadTimeInput.valueAsNumber = cfg.reloadtime;
  activeBackupInput.checked = cfg.activeBackup;


  loadNow.onclick = () => {
    appBackup.checkFolders();
  }
  advancedSettings.onclick = () => {
    return new Promise<chrome.tabs.Tab>((resolve, reject) => {
      chrome.tabs.create({
        'url': 'advancedSettings.html'
      }, (tab) => { resolve(tab) });
    })
  }

  window.onunload = async () => {
    cfg.reloadtime = parseFloat(reloadTimeInput.value);
    cfg.activeBackup = activeBackupInput.checked;
    
    appBackup.dataChanged(cfg);
  }



}



