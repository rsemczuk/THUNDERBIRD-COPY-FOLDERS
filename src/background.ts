interface FolderCopyTo {
    email: string;
    folderPath: string;
    targetPath: string;
    targetEmail: string;
    copyFolder: boolean;
    folderName: string;
}


interface AppCfg {
    activeBackup: boolean,
    reloadtime: number,
    targetCopyFolders: FolderCopyTo[],
    defaultTargetEmail: string;
    defaultCopy: boolean;
    suppressEmailDomain: boolean
}


class AppBackup {
    interval: any;
    allAccounts: browser.accounts.MailAccount[];
    localAccount: browser.accounts.MailAccount;
    defaultAccount: browser.accounts.MailAccount;
    externalAccounts: browser.accounts.MailAccount[];
    allEmailFolders: browser.folders.MailFolder[];
    allExternalEmailFolders: browser.folders.MailFolder[];
    cfg: AppCfg;


    private async copyEmails(destinyFolder: browser.folders.MailFolder, originFolder: browser.folders.MailFolder, originMsgs?: browser.messages.MessageHeader[]) {
        if (!destinyFolder || !originFolder) return;

        // let destinyMsgs = await this.getAllMessagesFolder(destinyFolder);
        if (!originMsgs) originMsgs = await this.getAllMessagesFolder(originFolder);
        // let listMsgId: number[] = []
        if (originMsgs)// && destinyMsgs
            for (let email of originMsgs) {
                if (!await this._containEmail(email, destinyFolder)) {
                    await browser.messages.copy([email.id], destinyFolder)
                    // listMsgId.push(email.id);
                }
            }
        // if (listMsgId.length > 0) await browser.messages.copy(listMsgId, destinyFolder)

    }

    private async _containEmail(email: browser.messages.MessageHeader, destinyFolder: browser.folders.MailFolder) {
        let _fromDate = new Date(email.date.getTime() - 1000)
        let _toDate = new Date(email.date.getTime() + 1000);
        let findEmail: browser.messages.MessageList;
        if (email.headerMessageId) {
            findEmail = await browser.messages.query({
                folder: destinyFolder,
                subject: email.subject,
                fromDate: _fromDate,
                toDate: _toDate,
                author: email.author,
                headerMessageId: email.headerMessageId
            });
        } else {
            findEmail = await browser.messages.query({
                folder: destinyFolder,
                subject: email.subject,
                fromDate: _fromDate,
                toDate: _toDate,
                author: email.author
            });
        }
        return findEmail && findEmail.messages && findEmail.messages.length > 0;
    }

    private containEmail(email: browser.messages.MessageHeader, searchList: browser.messages.MessageHeader[]) {
        for (let localEmail of searchList) {
            if (
                localEmail.subject == email.subject &&
                localEmail.date.getTime() == email.date.getTime() &&
                localEmail.author == email.author &&
                localEmail.headerMessageId == email.headerMessageId

            ) {
                return true;
            }
        }
        return false;
    }
    private async getAllMessagesFolder(folder: browser.folders.MailFolder) {
        if (!folder) return null;


        let messages: browser.messages.MessageHeader[] = [];
        let _fromDate = new Date(1990, 0, 1);
        let _toDate = new Date();
        let findEmails = await browser.messages.query({
            folder: folder,
            // fromDate: _fromDate,
            // toDate: _toDate
        });
        let page = await browser.messages.list(folder);
        messages = messages.concat(page.messages);
        while (page.id) {
            page = await browser.messages.continueList(page.id);
            messages = messages.concat(page.messages);
        }
        return messages;
    }

    /**
     * 
     * @returns 
     */
    private loadFolderCopyTo() {
        // criar config de todas as pastas;
        let updateFolderCopyTo = () => {
            this.allEmailFolders.forEach((f) => {
                let ac = this.getAccountById(f.accountId);
                let email = ac.identities[0] ? ac.identities[0].email : "";
                let folderCopyTo = this.getFolderCopyTo(email, f.path);
                if (!folderCopyTo) {
                    let defaultFolderModel = this.getDefaultFolderCopyTo(email, f.path);
                    this.createFolderCopyTo(defaultFolderModel.email, defaultFolderModel.targetPath, defaultFolderModel.folderPath, defaultFolderModel.copyFolder, defaultFolderModel.folderName, defaultFolderModel.targetEmail);
                }
            });
        }
        updateFolderCopyTo();

        //deletar folderCopyTo que não tenham pasta correspondente
        for (let f of this.cfg.targetCopyFolders.concat()) {
            let a = this.getEmailFolder(f.email, f.folderPath);
            if (!a) {
                for (let ff of this.cfg.targetCopyFolders.concat()) {
                    if (ff.targetEmail === f.folderPath && ff.targetEmail === f.email) {
                        ff.copyFolder = false;
                        ff.targetEmail = "";
                        ff.targetPath = "";
                        this.deleteFolderCopyTo(ff);
                    }
                }

                this.deleteFolderCopyTo(f);
            }
        }
        return this.saveCfg();

    }
    // resolver:: não deletar a configuração toda vez que adiciona uma conta de email
    public async checkFolders() {
        await this.loadParamters();
        let time = new Date().getTime();

        console.log(browser.i18n.getMessage("startBackup"));
        if (this.localAccount.identities.length > 0) {
            console.log('erro na captura da pasta local: necessário rever a configuração do app');
            return;
        };

        for (let externalEmailFolder of this.allExternalEmailFolders) {
            let curAcc = this.getAccountById(externalEmailFolder.accountId);
            let copyFolderTo = this.getFolderCopyTo(curAcc.identities[0].email, externalEmailFolder.path);
            if (!copyFolderTo.copyFolder) continue;
            let originFolder = this.getEmailFolder(copyFolderTo.email, copyFolderTo.folderPath);
            let destinyFolder: browser.folders.MailFolder;
            let targetAcc = this.getAccountByEmail(copyFolderTo.targetEmail);
            destinyFolder = this.getEmailFolder(copyFolderTo.targetEmail, copyFolderTo.targetPath);
            if (!destinyFolder) {
                let folders = Array.from(copyFolderTo.targetPath.split('/'));
                folders.shift();
                let previosDestinyFolder: browser.folders.MailFolder = { path: '/', accountId: targetAcc.id }
                let curCreatePath = "";
                for (let folderName of folders) {
                    curCreatePath += "/" + folderName;
                    let curDestinyFolder = this.getEmailFolder(copyFolderTo.targetEmail, curCreatePath);
                    if (curDestinyFolder) {
                        previosDestinyFolder = curDestinyFolder;
                    } else {
                        try {
                            previosDestinyFolder = await browser.folders.create(previosDestinyFolder, folderName);
                        } catch (error) {
                            console.log(error)
                        } finally {
                            await this.loadParamters();
                        }
                    }
                }
            }
            destinyFolder = this.getEmailFolder(copyFolderTo.targetEmail, copyFolderTo.targetPath);
            this.copyEmails(destinyFolder, originFolder); //await
        }

        console.log(browser.i18n.getMessage("endBackupIn") + " " + (new Date().getTime() - time) + " " + browser.i18n.getMessage("milliseconds"));


    }



    async loadParamters() {
        this.allAccounts = await browser.accounts.list();
        this.externalAccounts = this.allAccounts.filter((email, i, arr) => {
            return email.identities[0] ? true : false;
        });
        this.localAccount = this.allAccounts.filter((email, i, arr) => {
            return email.identities[0] ? false : true;
        })[0];// assumir que a pasta local não possúi email



        let emailFolders: browser.folders.MailFolder[] = [];
        for (let acc of this.allAccounts) {
            let loop = (folders: browser.folders.MailFolder[]) => {
                for (let curFolder of folders || []) {
                    emailFolders.push(curFolder);
                    loop(curFolder.subFolders)
                }

            }
            loop(acc.folders);

        }
        this.allEmailFolders = emailFolders;
        let externalEmailFolders: browser.folders.MailFolder[] = [];
        for (let acc of this.externalAccounts) {
            let loop = (folders: browser.folders.MailFolder[]) => {
                for (let curFolder of folders || []) {
                    externalEmailFolders.push(curFolder);
                    loop(curFolder.subFolders)
                }
            }
            loop(acc.folders);
        }
        this.allExternalEmailFolders = externalEmailFolders;
        //carregar this.cfg
        await this.loadCfg();

        this.defaultAccount = this.getAccountByEmail(this.cfg.defaultTargetEmail);

        await this.loadFolderCopyTo();

    }




    async start() {
        // await this.resetCfg();
        await this.loadParamters();
        browser.messages.onNewMailReceived.addListener(this.listenerMsg);
        if (this.cfg.activeBackup) {
            this.interval = setInterval(() => this.checkFolders(), 1000 * 60 * this.cfg.reloadtime);
            setTimeout(() => {
                this.checkFolders();
            }, 60000 * 3);

        }
    }
    private listenerMsg(folder: browser.folders.MailFolder, messages: browser.messages.MessageList) {
        if (!this.cfg.activeBackup) return;
        // console.log('listener');
        // console.log(folder);
        // console.log(messages);
        // if (messages.messages.length === 0) return;
        let curAcc = this.getAccountById(folder.accountId);
        // console.log("asdf", curAcc);
        if (!curAcc.identities[0]) return;
        let copyFolderTo = this.getFolderCopyTo(curAcc.identities[0].email, folder.path);
        // console.log(copyFolderTo);
        if (copyFolderTo && !copyFolderTo.copyFolder) return;
        let destinyFolder = this.getEmailFolder(copyFolderTo.targetEmail, copyFolderTo.targetPath);
        // console.log(destinyFolder);
        if (!destinyFolder) return;
        this.copyEmails(destinyFolder, folder, messages.messages);

    }


    async dataChanged() {//cfg: AppCfg
        await this.saveCfg();
        if (this.cfg.activeBackup) {
            if (this.interval) {
                clearInterval(this.interval);
            }
            this.interval = setInterval(() => this.checkFolders(), 1000 * 60 * this.cfg.reloadtime);
        } else {
            if (this.interval) {
                clearInterval(this.interval);
                this.interval = null;
            }
        }
        this.loadParamters();
    }

    saveCfg() {//cfg?: AppCfg
        return new Promise<void>((resolve, reject) => {
            chrome.storage.local.set({
                cfg: this.cfg//cfg ? cfg : 
            }, () => {
                this.cfg = this.cfg;//cfg ? cfg : 
                resolve();
            });
        })
    }

    resetCfg() {
        return new Promise<void>((resolve, reject) => {
            chrome.storage.local.remove("cfg", async () => {
                await this.loadParamters();
                resolve();
            });
        })
    }

    private getDefaultCfg(): AppCfg {
        return {
            activeBackup: false,
            defaultTargetEmail: '',
            reloadtime: 60,
            targetCopyFolders: this.generateDefaultTargeFolders(),
            defaultCopy: true,
            suppressEmailDomain: false
        }
    }

    private loadCfg() {
        return new Promise<void>((resolve, reject) => {
            chrome.storage.local.get((itens: { cfg: AppCfg }) => {
                let defaultCfg = this.getDefaultCfg();
                if (!itens || !(itens.cfg)) {
                    this.cfg = defaultCfg;
                    this.saveCfg()
                    resolve()
                } else {
                    this.cfg = itens.cfg;
                    let save = false;
                    if (typeof itens.cfg.activeBackup !== 'boolean') {
                        itens.cfg.activeBackup = defaultCfg.activeBackup;
                        save = true;
                    }
                    if (typeof itens.cfg.reloadtime !== 'number') {
                        itens.cfg.reloadtime = defaultCfg.reloadtime;
                        save = true;
                    }
                    if (typeof itens.cfg.defaultTargetEmail !== 'string') {
                        itens.cfg.defaultTargetEmail = defaultCfg.defaultTargetEmail;
                        save = true;
                    }
                    if (!Array.isArray(itens.cfg.targetCopyFolders) || itens.cfg.targetCopyFolders.length === 0) {
                        itens.cfg.targetCopyFolders = defaultCfg.targetCopyFolders;
                        save = true;
                    }
                    if (save) this.saveCfg();
                    resolve()
                }

            });
        })
    }




    getAccountById(id: string) {
        for (let acc of this.allAccounts) {
            if (acc.id === id) {
                return acc;
            }
        }
        return null;
    }

    getAccountByEmail(email: string) {
        for (let acc of this.allAccounts) {
            if (acc.identities[0] && acc.identities[0].email === email || !acc.identities[0] && email === "") {
                return acc;
            }
        }
        return null;
    }

    getEmailFolder(email: string, path: string) {
        for (let copyFolderTo of this.allAccounts) {
            if (copyFolderTo.identities[0] && copyFolderTo.identities[0].email === email || email === "" && !copyFolderTo.identities[0]) {
                let loop = (folders: browser.folders.MailFolder[]): browser.folders.MailFolder => {
                    for (let curFolder of folders) {
                        if (curFolder.path === path) {
                            return curFolder;
                        }
                        if (curFolder.subFolders) {
                            let findedFolder = loop(curFolder.subFolders)
                            if (findedFolder) return findedFolder;
                        }
                    }
                }
                let findFolder = loop(copyFolderTo.folders);
                if (findFolder) {
                    return findFolder;
                }
            }
        }
        return null;
    }


    getFolderCopyTo(email: string, path: string) {
        for (let copyFolderTo of this.cfg.targetCopyFolders) {
            if (copyFolderTo.folderPath === path && copyFolderTo.email === email) {
                return copyFolderTo;
            }
        }
        return null;
    }

    updateFolderCopyTo(folderCopyTo: FolderCopyTo) {
        this.cfg.targetCopyFolders.forEach((copyFolderTo, index) => {
            if (copyFolderTo.folderPath === folderCopyTo.folderPath && copyFolderTo.email === folderCopyTo.email) {
                this.cfg.targetCopyFolders[index] = folderCopyTo;
                return this.saveCfg();
            }
        });
    }
    deleteFolderCopyTo(folderCopyTo: FolderCopyTo) {
        this.cfg.targetCopyFolders.forEach((copyFolderTo, index) => {
            if (copyFolderTo.folderPath === folderCopyTo.folderPath && copyFolderTo.email === folderCopyTo.email) {
                this.cfg.targetCopyFolders.splice(index, 1);
                return this.saveCfg();
            }
        });
    }

    createFolderCopyTo(email: string, targetPath: string, folderPath: string, copyFolder: boolean, folderName: string, targetEmail: string) {
        let folderCopyTo = this.getFolderCopyTo(email, targetPath);
        if (!folderCopyTo) {
            folderCopyTo = {
                copyFolder: copyFolder,
                email: email,
                folderName: folderName,
                targetPath: targetPath,
                folderPath: folderPath,
                targetEmail: targetEmail
            };
            this.cfg.targetCopyFolders.push(folderCopyTo);
            this.saveCfg();
        }
        return folderCopyTo;
    }




    generateDefaultTargeFolders() {
        let foldersCopyTo: FolderCopyTo[] = [];
        this.allAccounts.forEach((acc) => {
            let email = acc.identities[0] ? acc.identities[0].email : '';
            let loop = (subFolders: browser.folders.MailFolder[], targetFolderPath: string) => {
                subFolders.forEach((subFolder) => {
                    let curTargetFolderPath = targetFolderPath + "/" + subFolder.name

                    let copyFolder = true;//default true
                    let targetEmail = "";//default "";
                    let targetPath = email === '' ? '' : curTargetFolderPath;
                    if (this.cfg) {
                        targetEmail = this.cfg.defaultTargetEmail
                        copyFolder = this.cfg.defaultCopy;
                        if (email === '') copyFolder = false;

                        // if (!this.cfg.defaultCopy) {
                        //     targetPath = "";
                        // }


                    }

                    foldersCopyTo.push({
                        copyFolder: copyFolder,
                        email: email,
                        targetPath: targetPath,
                        folderName: subFolder.name,
                        folderPath: subFolder.path,
                        targetEmail: targetEmail
                    })
                    if (subFolder.subFolders) {
                        loop(subFolder.subFolders, curTargetFolderPath);
                    }
                });
            }
            let path = "";
            if (email !== '' && this.cfg && this.cfg.suppressEmailDomain) {
                path = '/' + email.split("@")[0];
            } else if (email === '') {
                path = '';
            } else {
                path = '/' + email.replace(/@/g, '.')
            }


            loop(acc.folders, path);
        });
        return foldersCopyTo;
    }

    getDefaultFolderCopyTo(email: string, path: string) {
        for (let defaultFolderCopyTo of (this.generateDefaultTargeFolders())) {
            if (defaultFolderCopyTo.email === email && defaultFolderCopyTo.folderPath === path) {
                return defaultFolderCopyTo;
            }
        }
        return null;
    }




}
var appBackup = new AppBackup();
window.addEventListener('load', (e) => {
    appBackup.start();

})
