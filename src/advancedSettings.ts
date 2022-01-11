window.onload = async () => {
    let appBackup = (<WindowApp>window.browser.extension.getBackgroundPage()).appBackup;
    await appBackup.loadFolderCopyTo();
    let cfg = await appBackup.getCfg();
    let externalAccounts = await appBackup.getExternalAccounts();

    let modelFolder = document.createElement('div');
    modelFolder.className = 'foldercontainer';
    let ico = document.createElement('img');
    ico.style.width = '23px';
    ico.style.height = '20px';
    ico.src = "icons/folder.svg";
    ico.style.paddingRight = "5px";
    let txtSpanFolder = document.createElement('span');
    let span = document.createElement('span');
    span.append(ico, txtSpanFolder);
    span.className = 'folder';

    modelFolder.append(span);



    let friendNameFolder = async (folder: browser.folders.MailFolder) => {
        let arr = Array.from(folder.path.split('/'));
        arr.shift();
        let acc = await appBackup.getAccountById(folder.accountId);
        let email = (acc.identities.length > 0) ? acc.identities[0].email : "";
        let acumulatorName = '';
        let acumulatorPath = '';
        for (let str of arr) {
            acumulatorPath += '/' + str;
            let emailFolder = await appBackup.getEmailFolder(email, acumulatorPath)
            acumulatorName += '/' + emailFolder.name;

        }
        return acumulatorName;


    }


    let selectFolder = document.createElement('select');


    let opDoNotCopy = document.createElement('option');
    opDoNotCopy.id = "doNotCopy;doNotCopy";
    opDoNotCopy.innerText = browser.i18n.getMessage("doNotCopy");
    selectFolder.append(opDoNotCopy);
    let opDefault = document.createElement('option');
    opDefault.id = "opDefault;opDefault";
    opDefault.innerText = browser.i18n.getMessage("defaultFolder");
    selectFolder.append(opDefault);



    let allFolders = await appBackup.getAllEmailFolders();



    for (let _folder of allFolders) {
        let op = document.createElement('option');
        op.id = _folder.path + ";" + _folder.accountId;
        let acc = await appBackup.getAccountById(_folder.accountId);
        let accName = acc.identities[0] ? acc.identities[0].email : browser.i18n.getMessage("localFolder");
        op.innerText = accName + (await friendNameFolder(_folder)).replace(/\//g, ">");
        selectFolder.append(op);
    }



    let hierarchy = <HTMLDivElement>document.getElementById('hierarchy');


    externalAccounts.forEach((acc) => {
        let curAccFolder = <HTMLDivElement>modelFolder.cloneNode(true);
        (<HTMLSpanElement>curAccFolder.firstChild.childNodes[1]).innerText = acc.identities[0].email;

        hierarchy.append(curAccFolder);

        let loop = (subFolders: browser.folders.MailFolder[], divFolder: HTMLDivElement, targetFolderPath: string) => {
            subFolders.forEach(async (subFolder) => {
                let curTargetFolderPath = targetFolderPath + "/" + subFolder.name

                let curDivFolder = <HTMLDivElement>modelFolder.cloneNode(true);
                let span = <HTMLSpanElement>curDivFolder.firstChild.childNodes[1];
                span.className = "folder-text";
                span.innerText = subFolder.name;

                span.append(" ---> " + browser.i18n.getMessage('copyTo') + " : ");


                let folderCopyTo = await appBackup.getFolderCopyTo(acc.identities[0].email, subFolder.path);
                let select = <HTMLSelectElement>selectFolder.cloneNode(true);
                let optDoNotCopy = select.options.item(0);
                let optDefault = select.options.item(1);


                select.onchange = async () => {
                    let selectedOpt = select.selectedOptions[0];
                    let infos = selectedOpt.id.split(';');
                    switch (infos[1]) {
                        case 'doNotCopy':
                            folderCopyTo.copyFolder = false;
                            folderCopyTo.defaultTargetFolder = false;
                            folderCopyTo.targetPath = "";
                            folderCopyTo.targetEmail = "";
                            break;
                        case 'opDefault':
                            folderCopyTo.copyFolder = true;
                            folderCopyTo.defaultTargetFolder = true;
                            folderCopyTo.targetPath = "";
                            folderCopyTo.targetEmail = "";
                            break;

                        default:
                            let targetAcc = await appBackup.getAccountById(infos[1]);
                            let accEmail = targetAcc.identities[0] ? targetAcc.identities[0].email : "";
                            let targetFolderCopyTo = await appBackup.getDefaultFolderCopyTo(accEmail, infos[0]);
                            folderCopyTo.copyFolder = true;
                            folderCopyTo.defaultTargetFolder = false;
                            folderCopyTo.targetPath = targetFolderCopyTo.folderPath;
                            folderCopyTo.targetEmail = targetFolderCopyTo.email;
                            break;
                    }
                    appBackup.updateFolderCopyTo(folderCopyTo);

                }
                for (let targetCopyFolder of cfg.targetCopyFolders) {
                    if (targetCopyFolder.folderPath === folderCopyTo.folderPath && targetCopyFolder.email === acc.identities[0].email) {
                        let defaultFolderCopyTo = await appBackup.getDefaultFolderCopyTo(folderCopyTo.email, folderCopyTo.folderPath)
                        optDefault.innerText += " --> /" + browser.i18n.getMessage('localFolder') + defaultFolderCopyTo.targetPath;

                        if (!targetCopyFolder.copyFolder) {
                            optDoNotCopy.selected = true;
                        } else if (targetCopyFolder.defaultTargetFolder) {
                            optDefault.selected = true
                        } else

                            for (let op of Array.from(select.options)) {
                                let ids = op.id.split(';');
                                let _account = await appBackup.getAccountByEmail(targetCopyFolder.targetEmail);
                                if (ids[0] === targetCopyFolder.targetPath && ids[1] === _account.id) {
                                    op.selected = true;
                                }

                            }

                    }


                }

                span.append(select);
                divFolder.append(curDivFolder);

                if (subFolder.subFolders) {
                    loop(subFolder.subFolders, curDivFolder, curTargetFolderPath);
                }
            })
        }
        loop(acc.folders, curAccFolder, "");
    })

    document.querySelectorAll<HTMLElement>("[data-locale]").forEach(elem => {
        elem.innerText = browser.i18n.getMessage(elem.dataset.locale);
    });
}

