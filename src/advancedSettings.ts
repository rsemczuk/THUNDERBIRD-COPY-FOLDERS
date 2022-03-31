window.onload = async () => {
    let appBackup = (<WindowApp>window.browser.extension.getBackgroundPage()).appBackup;
    await appBackup.loadParamters();
    let cfg = appBackup.cfg;
    let externalAccounts = appBackup.externalAccounts;
    let allAccounts = appBackup.allAccounts;
    let localAccount = appBackup.localAccount;
    let defaultAccount = appBackup.defaultAccount;


    let modelFolder = document.createElement('span');
    modelFolder.className = 'foldercontainer';
    let ico = document.createElement('img');
    ico.style.width = '23px';
    ico.style.height = '20px';
    ico.src = "icons/folder.svg";
    ico.style.paddingRight = "5px";
    let txtSpanFolder = document.createElement('span');
    txtSpanFolder.id = 'spanTxt';
    txtSpanFolder.className = 'folder';

    let span = document.createElement('span');
    span.append(ico, txtSpanFolder);
    span.className = 'folder';

    modelFolder.append(span);

    let reloadPage = () => {
        document.location.reload();
    }


    /**
     * botão de resetar a configuração
     */

    let resetConfiguration = <HTMLButtonElement>document.getElementById('resetConfiguration');
    let downloadConfiguration = <HTMLButtonElement>document.getElementById('downloadConfiguration');



    let inputReloadTime = <HTMLInputElement>document.getElementById("reloadtime");
    let inputActiveBackup = <HTMLInputElement>document.getElementById("activeBackup");
    let backupNow = <HTMLInputElement>document.getElementById("loadNow");
    inputReloadTime.valueAsNumber = cfg.reloadtime;
    inputActiveBackup.checked = cfg.activeBackup;

    inputReloadTime.onchange = () => {
        cfg.reloadtime = parseFloat(inputReloadTime.value);
        appBackup.saveCfg();
    }

    inputActiveBackup.onchange = () => {
        cfg.activeBackup = inputActiveBackup.checked;
        appBackup.saveCfg();
    }


    backupNow.onclick = () => {
        appBackup.checkFolders();
    }


    let inputCopy = <HTMLInputElement>document.getElementById('copy');
    inputCopy.checked = cfg.defaultCopy;
    inputCopy.onchange = () => {
        cfg.defaultCopy = inputCopy.checked;
        appBackup.saveCfg()
    }

    let inputSuppressEmailDomain = <HTMLInputElement>document.getElementById('suppressEmailDomain');
    inputSuppressEmailDomain.checked = cfg.suppressEmailDomain;
    inputSuppressEmailDomain.onchange = () => {
        cfg.suppressEmailDomain = inputSuppressEmailDomain.checked;
        appBackup.saveCfg()
    }


    let btnOverwriteAllSettings = <HTMLButtonElement>document.getElementById('overwriteAllSettings');
    btnOverwriteAllSettings.onclick = () => {
        cfg.targetCopyFolders = appBackup.generateDefaultTargeFolders();
        appBackup.saveCfg();
        reloadPage()
    }



    resetConfiguration.onclick = async (e) => {
        e.preventDefault();
        await appBackup.resetCfg();
        reloadPage()
    }


    /**
     * 
     * @param filename nome do arquivo
     * @param text dados para download
     * @param type text/json / outros
     */
    function download(filename: string, text: string, type: 'text/plain' | 'text/json') {
        let element = document.createElement('a');
        element.setAttribute('href', 'data:' + type + 'charset=utf-8,' + encodeURIComponent(text));
        element.setAttribute('download', filename);
        element.style.display = 'none';
        document.body.appendChild(element);
        element.click();
        document.body.removeChild(element);
    }

    downloadConfiguration.onclick = async (e) => {
        let strCfg = JSON.stringify(appBackup.cfg, null, '  ');
        download('cfg.json', strCfg, 'text/json')

    }


    let friendNameFolder = (folder: browser.folders.MailFolder) => {
        let arr = Array.from(folder.path.split('/'));
        arr.shift();
        let acc = appBackup.getAccountById(folder.accountId);
        let email = (acc.identities.length > 0) ? acc.identities[0].email : "";
        let acumulatorName = '';
        let acumulatorPath = '';
        for (let str of arr) {
            acumulatorPath += '/' + str;
            let emailFolder = appBackup.getEmailFolder(email, acumulatorPath)
            acumulatorName += '/' + emailFolder.name;

        }
        return acumulatorName;


    }



    let selectPathFolder = document.createElement('select');
    /**
     * vazio para ter opção de limpar a configuração
     */
    let optVazio = document.createElement('option');
    optVazio.value = "";
    optVazio.dataset.accId = "";
    selectPathFolder.append(optVazio);

    let opDoNotCopy = document.createElement('option');
    opDoNotCopy.id = "doNotCopy";
    opDoNotCopy.value = browser.i18n.getMessage("doNotCopy");
    opDoNotCopy.dataset.accId = "";
    opDoNotCopy.innerText = browser.i18n.getMessage("doNotCopy");
    selectPathFolder.append(opDoNotCopy);

    let opDefault = document.createElement('option');
    opDefault.value = "";
    opDefault.id = "opDefault";
    opDefault.dataset.accId = "";
    opDefault.innerText = browser.i18n.getMessage("defaultPath");
    selectPathFolder.append(opDefault);





    for (let _folder of appBackup.allEmailFolders) {
        let op = document.createElement('option');
        op.innerText = (friendNameFolder(_folder));
        op.value = _folder.path;
        op.dataset.accId = _folder.accountId;
        selectPathFolder.append(op);
    }

    /**
     * id = accId
     * value = email
     */
    let selectAccount = document.createElement('select');
    for (let acc of allAccounts) {
        let op = document.createElement('option');
        op.id = acc.id;
        op.value = acc.identities[0] ? acc.identities[0].email : "";
        op.innerText = acc.identities[0] ? acc.identities[0].email : browser.i18n.getMessage("localFolders");

        if (acc.identities[0]) {
            selectAccount.append(op);
        } else {
            selectAccount.insertAdjacentElement('afterbegin', op);
        }

    }

    let containerSettings = <HTMLDivElement>document.getElementById('containerSettings');

    externalAccounts.forEach((acc) => {
        let curAccFolder = <HTMLDivElement>modelFolder.cloneNode(true);
        let _curAccEmail = acc.identities[0].email;

        let emailSpanTxt = (<HTMLSpanElement>curAccFolder.querySelector('#spanTxt'))
        emailSpanTxt.innerText = _curAccEmail;

        let btnCopyEmail = document.createElement('button');
        btnCopyEmail.className = "input";
        btnCopyEmail.type = "button";
        btnCopyEmail.innerText = browser.i18n.getMessage("markAllToCopy")
        emailSpanTxt.append(btnCopyEmail);
        //marcar folders para copiar
        btnCopyEmail.onclick = async () => {
            cfg.targetCopyFolders.forEach((f) => {
                if (f.email === _curAccEmail) {
                    f.copyFolder = true;
                    if (f.targetPath === "") {
                        let defaultFolder = appBackup.getDefaultFolderCopyTo(_curAccEmail, f.folderPath);
                        f.targetPath = defaultFolder.targetPath;
                        f.targetEmail = defaultFolder.targetEmail;
                    }

                }
            });
            await appBackup.saveCfg();
            reloadPage();
        }
        let btnDoNotCopyEmail = document.createElement('button');
        btnDoNotCopyEmail.className = "input"
        btnDoNotCopyEmail.type = "button";
        btnDoNotCopyEmail.innerText = browser.i18n.getMessage("markAllNotToCopy")
        emailSpanTxt.append(btnDoNotCopyEmail);
        btnDoNotCopyEmail.onclick = async () => {
            cfg.targetCopyFolders.forEach((f) => {
                if (f.email === _curAccEmail) {
                    f.copyFolder = false;
                }
            });
            await appBackup.saveCfg();
            reloadPage();

        }

        let btnRestoreToDefaultEmail = document.createElement('button');
        btnRestoreToDefaultEmail.className = "input";
        btnRestoreToDefaultEmail.type = "button";
        btnRestoreToDefaultEmail.innerText = browser.i18n.getMessage("restoreDefault")
        btnRestoreToDefaultEmail.title = browser.i18n.getMessage("titleRestoreDefault")
        emailSpanTxt.append(btnRestoreToDefaultEmail);
        //marcar folders para copiar
        btnRestoreToDefaultEmail.onclick = async () => {
            cfg.targetCopyFolders.forEach((f) => {
                if (f.email === _curAccEmail) {
                    let defaultFolder = appBackup.getDefaultFolderCopyTo(_curAccEmail, f.folderPath);
                    f.copyFolder = defaultFolder.copyFolder;
                    f.targetPath = defaultFolder.targetPath;
                    f.targetEmail = defaultFolder.targetEmail;

                }
            });
            await appBackup.saveCfg();
            reloadPage();
        }

        containerSettings.append(curAccFolder);

        let loop = (subFolders: browser.folders.MailFolder[], divFolder: HTMLDivElement, targetFolderPath: string) => {
            subFolders.forEach((subFolder) => {
                let _curTargetFolderPath = targetFolderPath + "/" + subFolder.name
                let _curDivFolder = <HTMLDivElement>modelFolder.cloneNode(true);

                let _span = <HTMLSpanElement>_curDivFolder.querySelector('#spanTxt');
                _span.innerText = subFolder.name;
                _span.append(" ---> " + browser.i18n.getMessage('copyTo') + " : ");
                let _btnSave = document.createElement('button');
                _btnSave.className = "input";
                _btnSave.id = 'btnSave'
                _btnSave.innerText = browser.i18n.getMessage("save");
                let _folderCopyTo = appBackup.getFolderCopyTo(_curAccEmail, subFolder.path);

                let _defaultFolderCopyTo = appBackup.getDefaultFolderCopyTo(_folderCopyTo.email, _folderCopyTo.folderPath)


                let _selectPath = <HTMLSelectElement>selectPathFolder.cloneNode(true);
                let _optPathDoNotCopy = _selectPath.options.item(1);
                let _optPathDefault = _selectPath.options.item(2);

                // select account
                let _selectAccount = <HTMLSelectElement>selectAccount.cloneNode(true);

                /// valor path
                let inputEditable = document.createElement('input');
                inputEditable.type = "text";

                // trocar o onchange por um botão
                _btnSave.onclick = () => {
                    let selectedOpt = _selectPath.selectedOptions[0];
                    let update = false;
                    switch (selectedOpt.id) {
                        case 'doNotCopy':
                            _folderCopyTo.copyFolder = false;
                            update = true;
                            break;
                        default:
                            _folderCopyTo.copyFolder = true;
                            _folderCopyTo.targetPath = inputEditable.value;
                            _folderCopyTo.targetEmail = _selectAccount.selectedOptions[0].value;
                            update = true;
                            break;
                    }
                    if (update) appBackup.updateFolderCopyTo(_folderCopyTo);

                }

                for (let i = 0; i < _selectAccount.options.length; i++) {
                    let op = _selectAccount.options[i];
                    if (_folderCopyTo.targetEmail === op.value) {
                        op.selected = true;
                    } else if (_folderCopyTo.targetEmail === '' && op.value === '') {
                        op.selected = true;
                    } else {
                        op.selected = false;
                    }

                }

                /**
                 * mostrar apenas as opções da conta target selecionada
                 */
                let hidenOtherPathsAccounts = () => {
                    let selectedAccOpt = _selectAccount.selectedOptions[0];
                    if (_selectPath.options.length > 3)
                        for (let i = 3; i < _selectPath.options.length; i++) {
                            let curOpt = _selectPath.options[i];
                            curOpt.hidden = false;
                            if (curOpt.dataset.accId === selectedAccOpt.id) {
                                curOpt.hidden = false;
                            } else {
                                curOpt.hidden = true;
                            }

                        }
                }

                _selectAccount.onchange = () => {
                    // popular 
                    hidenOtherPathsAccounts();
                    _selectPath.options[0].selected = true;
                }

                // selecionar opt salvo e gerar nome
                for (let targetCopyFolder of cfg.targetCopyFolders) {
                    if (targetCopyFolder.folderPath === _folderCopyTo.folderPath && targetCopyFolder.email === _curAccEmail) {
                        let emailPath = cfg.suppressEmailDomain ? _folderCopyTo.email.split("@")[0] : _folderCopyTo.email.replace(/@/g, '.');
                        _optPathDefault.innerText += " --> /" + emailPath + _curTargetFolderPath;
                        _optPathDefault.value = "/" + emailPath + _curTargetFolderPath;//friendNameFolder(_folderCopyTo)//_defaultFolderCopyTo.targetPath;
                        if (!targetCopyFolder.copyFolder) {
                            _optPathDoNotCopy.selected = true;
                        } else {
                            let hasSelect = false;

                            for (let op of Array.from(_selectPath.options)) {
                                let id = op.dataset.accId;
                                let path = op.value;
                                let _account = appBackup.getAccountByEmail(targetCopyFolder.targetEmail);
                                if (path === targetCopyFolder.targetPath && id === _account.id) {
                                    if (path === _defaultFolderCopyTo.targetPath && id === defaultAccount.id) {
                                        _optPathDefault.selected = true;

                                    } else {
                                        op.selected = true;

                                    }
                                }
                            }

                            if (!hasSelect) {

                            }
                        }

                    }
                }

                hidenOtherPathsAccounts();








                if (!_folderCopyTo.copyFolder) {
                    inputEditable.value = browser.i18n.getMessage('doNotCopy');
                } else {
                    inputEditable.value = _folderCopyTo.targetPath;
                }

                inputEditable.onchange = () => {
                    _selectPath.selectedIndex = 0;
                }
                inputEditable.oninput = () => {
                    _selectPath.selectedIndex = 0;
                    _selectPath.options[0].value = inputEditable.value;
                    _selectPath.options[0].innerHTML = inputEditable.value
                }

                _selectPath.onchange = () => {
                    inputEditable.value = _selectPath.value
                }


                let divSelect = document.createElement('span');
                divSelect.className = "inputselect";

                divSelect.append(_selectPath);
                divSelect.append(inputEditable);

                _span.append(_selectAccount);
                _span.append(divSelect);

                _span.append(_btnSave);
                divFolder.append(_curDivFolder);
                if (subFolder.subFolders) {
                    loop(subFolder.subFolders, _curDivFolder, _curTargetFolderPath);
                }
            })
        }
        loop(acc.folders, curAccFolder, "");
    });

    let defaultDestination = <HTMLSelectElement>document.getElementById('defaultDestination');
    externalAccounts.forEach((a) => {
        let op = document.createElement('option');
        op.value = a.identities[0].email;
        op.innerText = a.identities[0].email;
        defaultDestination.append(op);
        if (op.value === cfg.defaultTargetEmail) {
            op.selected = true;
        } else {
            op.selected = false;
        }

    })

    defaultDestination.onchange = () => {
        cfg.defaultTargetEmail = defaultDestination.selectedOptions[0].value;
        appBackup.defaultAccount = appBackup.getAccountByEmail(defaultDestination.selectedOptions[0].value);
        defaultAccount = appBackup.defaultAccount;
        appBackup.saveCfg();

    }

    document.querySelectorAll<HTMLElement>("[data-locale]").forEach(elem => {
        elem.innerText = browser.i18n.getMessage(elem.dataset.locale);
    });
}

