interface FolderCopyTo {
    email: string;
    folderPath: string;
    targetPath: string;
    targetEmail: string;
    copyFolder: boolean;
    folderName: string;
}


type AppCfg = {
    activeBackup: boolean,
    reloadtime: number,
    fromDate: number,
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


    backupRunning = false;
    duplicatesRunning = false;
    stopBackupRunning = false;
    stopDuplicatesRunning = false;

    private async copyEmails(destinyFolder: browser.folders.MailFolder, originFolder: browser.folders.MailFolder, originMsgs?: browser.messages.MessageHeader[]) {
        if (!destinyFolder || !originFolder) return;
        if (!originMsgs) originMsgs = await this.getAllMessagesFolder(originFolder);

        let promises: Promise<void>[] = [];
        // let idList:number[] = []
        if (originMsgs) {
            for (let email of originMsgs) {
                if (this.stopBackupRunning) { console.log('backup stoped'); this.backupRunning = false; return; }
                if (!await this.containEmail(email, destinyFolder)) {
                    // idList.push(email.id);
                    try {
                        promises.push(browser.messages.copy([email.id], destinyFolder).then(() => console.log('copy ok'), (error) => console.log(error)));
                    } catch (error) {
                        console.log(error);
                    }
                }
            }
        }

        return promises;

    }

    private async containEmail(email: browser.messages.MessageHeader, destinyFolder: browser.folders.MailFolder) {
        let _fromDate = new Date(email.date.getTime() - 1000)
        let _toDate = new Date(email.date.getTime() + 1000);
        let findEmail: browser.messages.MessageList;

        try {
            if (email.headerMessageId) {
                findEmail = await browser.messages.query({
                    folder: destinyFolder,
                    // subject: email.subject,
                    fromDate: _fromDate,
                    toDate: _toDate,
                    // author: email.author,
                    headerMessageId: email.headerMessageId
                });
            }

            if (findEmail && findEmail.messages && findEmail.messages.length === 0) {
                findEmail = await browser.messages.query({
                    folder: destinyFolder,
                    subject: email.subject,
                    fromDate: _fromDate,
                    toDate: _toDate,
                    author: email.author
                });
            }
        } catch (error) {
            console.log(error);
        }

        return findEmail && findEmail.messages && findEmail.messages.length > 0;
    }



    async moverDuplicadasParaPastaLocal(folder: browser.folders.MailFolder) {
        console.log('move duplicates to localfolder start: ' + folder.path);
        if (this.duplicatesRunning) return browser.i18n.getMessage("duplicatesRunning");
        this.duplicatesRunning = true;
        this.stopDuplicatesRunning = false;
        let allMessages = await this.getAllMessagesFolder(folder, 7000);
        let moveMsgs: Promise<void>[] = [];
        let f = async () => {
            let msgFind = allMessages.shift();
            for (let i = 0; i < allMessages.length; i++) {
                let msg = allMessages[i];
                if (this.stopDuplicatesRunning) { console.log('duplicates stoped'); this.stopDuplicatesRunning = false; this.duplicatesRunning = false; return; }
                let findOk = async () => {
                    allMessages.splice(i, 1);
                    i--;
                    if (this.stopDuplicatesRunning) { console.log('duplicates stoped'); this.stopDuplicatesRunning = false; this.duplicatesRunning = false; return; }
                    let acc = this.getAccountById(msg.folder.accountId);
                    let path = this.getDefaultFolderCopyTo((acc.identities[0] ? acc.identities[0].email : ""), msg.folder.path).targetPath;
                    path = path.replace(/^\//, '/duplicate_emails/');
                    let folder = await this.getOrCreateFolder("", path);
                    moveMsgs.push(browser.messages.move([msg.id], folder));

                }


                if (msg.headerMessageId && msg.headerMessageId === msgFind.headerMessageId && msg.id !== msgFind.id) {
                    await findOk();
                    // break;
                } else if (msg.date.getTime() === msgFind.date.getTime() &&
                    msg.subject === msgFind.subject &&
                    msg.author === msgFind.author &&
                    msg.id !== msgFind.id) {
                    await findOk();
                    // break;
                }


            }

            if (allMessages.length > 0) {
                await f();
            }
        }
        if (allMessages.length > 1) await f();
        await Promise.all(moveMsgs);
        this.duplicatesRunning = false;
        console.log('move duplicates to localfolder end: ' + folder.path)
        // console.log(allMessages);
    }

    private async getAllMessagesFolder(folder: browser.folders.MailFolder, copyLastDays: number = this.cfg.fromDate) {
        if (!folder) return null;


        let messages: browser.messages.MessageHeader[] = [];

        try {
            let _fromDate = new Date(new Date().getTime() - (copyLastDays * 1000 * 60 * 60 * 24));
            // let _toDate = new Date();
            let findEmails = await browser.messages.query({
                folder: folder,
                fromDate: _fromDate,
                // toDate: _toDate
            });
            let page = findEmails;//await browser.messages.list(folder);
            messages = messages.concat(page.messages);
            while (page.id) {
                page = await browser.messages.continueList(page.id);
                messages = messages.concat(page.messages);
            }
        } catch (error) {
            console.log(error);
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
                    this.createFolderCopyTo(defaultFolderModel.email, "", defaultFolderModel.folderPath, false, defaultFolderModel.folderName, "");
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
        if (this.backupRunning) return browser.i18n.getMessage("backupRunning");
        this.backupRunning = true;
        this.stopBackupRunning = false;
        await this.loadParamters();
        let time = new Date().getTime();

        console.log(browser.i18n.getMessage("startBackup"));
        if (this.localAccount.identities.length > 0) {
            console.log('erro na captura da pasta local: necessário rever a configuração do app');
            return null;
        };

        let listPromises: Promise<void>[] = []

        for (let externalEmailFolder of this.allExternalEmailFolders) {
            if (this.stopBackupRunning) { console.log('backup stoped'); this.backupRunning = false; return null; }
            let curAcc = this.getAccountById(externalEmailFolder.accountId);
            let copyFolderTo = this.getFolderCopyTo(curAcc.identities[0].email, externalEmailFolder.path);
            if (!copyFolderTo.copyFolder) continue;
            let originFolder = this.getEmailFolder(copyFolderTo.email, copyFolderTo.folderPath);
            let destinyFolder = await this.getOrCreateFolder(copyFolderTo.targetEmail, copyFolderTo.targetPath);
            let l = await this.copyEmails(destinyFolder, originFolder);
            listPromises = listPromises.concat(l); //
        }
        try {
            await Promise.all(listPromises);
        } catch (error) {
            console.log(error)
        }

        console.log(browser.i18n.getMessage("endBackupIn") + " " + (new Date().getTime() - time) + " " + browser.i18n.getMessage("milliseconds"));
        this.backupRunning = false;
        return null;
    }


    private async getOrCreateFolder(email: string, path: string) {
        let destinyFolder = this.getEmailFolder(email, path);
        let targetAcc = this.getAccountByEmail(email);
        if (!destinyFolder) {
            let folders = Array.from(path.split('/'));
            folders.shift();
            let previosDestinyFolder: browser.folders.MailFolder = { path: '/', accountId: targetAcc.id }
            let curCreatePath = "";
            for (let folderName of folders) {
                curCreatePath += "/" + folderName;
                let curDestinyFolder = this.getEmailFolder(email, curCreatePath);
                if (curDestinyFolder) {
                    previosDestinyFolder = curDestinyFolder;
                } else {
                    try {
                        previosDestinyFolder = await browser.folders.create(previosDestinyFolder, folderName);
                    } catch (error) {
                        console.log("--->" + curCreatePath)
                        console.log(error)
                    } finally {
                        await this.loadParamters();
                    }
                }
            }
            destinyFolder = this.getEmailFolder(email, path);
        }

        return destinyFolder;
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
        await this.getCfg();
        browser.messages.onNewMailReceived.addListener(
            (folder, messages) => {
                if (!this.cfg.activeBackup) return;
                let curAcc = this.getAccountById(folder.accountId);
                if (!curAcc?.identities[0]) return;
                let copyFolderTo = this.getFolderCopyTo(curAcc.identities[0].email, folder.path);
                if (copyFolderTo && !copyFolderTo.copyFolder) return;
                let destinyFolder = this.getEmailFolder(copyFolderTo.targetEmail, copyFolderTo.targetPath);
                if (!destinyFolder) return;
                this.copyEmails(destinyFolder, folder, messages.messages);

            }
        );
        if (this.cfg.activeBackup) {
            this.interval = setInterval(() => this.checkFolders(), 1000 * 60 * this.cfg.reloadtime);
            setTimeout(() => {
                this.checkFolders();
            }, 60000 * 3);

        }

        this.defaultAccount = this.getAccountByEmail(this.cfg.defaultTargetEmail);

        await this.loadFolderCopyTo();

    }




    async start() {
        // await this.resetCfg();
        await this.loadParamters();


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

    async saveCfg() {
        for (let key in this.cfg) {
            await this.setCfg(<keyof AppCfg>key, this.cfg[key])
        }

    }

    resetCfg() {
        return new Promise<void>((resolve, reject) => {
            chrome.storage.local.clear(async () => {
                await this.loadParamters();
                resolve();
            });
        });
    }

    private getDefaultCfg(): AppCfg {
        return {
            activeBackup: false,
            defaultTargetEmail: '',
            reloadtime: 60,
            targetCopyFolders: this.generateDefaultTargeFolders(),
            defaultCopy: false,
            suppressEmailDomain: false,
            fromDate: 365 * 10
        }
    }

    private getCurCfg(key: keyof AppCfg) {
        return new Promise<keyof AppCfg>((resolve, reject) => {
            chrome.storage.local.get(key, (item) => {
                resolve(item[key]);
            })

        })

    }

    async getCfg() {
        let rawCfg = this.getDefaultCfg();
        if (!this.cfg) {
            this.cfg = <AppCfg>{};
        }

        let save = false;
        for (let key in rawCfg) {
            let curCfg: keyof AppCfg = await this.getCurCfg(<keyof AppCfg>key);
            // console.log(key, curCfg);
            let defaultCfg = this.getDefaultCfg();
            if (!curCfg && typeof curCfg !== 'boolean') {
                this.cfg[key] = defaultCfg[key];
                save = true;
            } else {
                switch (<keyof AppCfg>key) {
                    case 'activeBackup':
                        if (typeof curCfg !== 'boolean') {
                            curCfg = <any>defaultCfg.activeBackup;
                            save = true;
                        }
                        break;
                    case 'reloadtime':
                        if (typeof curCfg !== 'number') {
                            curCfg = <any>defaultCfg.reloadtime;
                            save = true;
                        }
                        break;
                    case 'fromDate':
                        if (typeof curCfg !== 'number') {
                            curCfg = <any>defaultCfg.fromDate;
                            save = true;
                        }
                        break;
                    case 'defaultTargetEmail':
                        if (typeof curCfg !== 'string') {
                            curCfg = <any>defaultCfg.defaultTargetEmail;
                            save = true;
                        }
                        break;
                    case 'targetCopyFolders':
                        if (!Array.isArray(curCfg) || curCfg.length === 0) {
                            curCfg = <any>defaultCfg.targetCopyFolders;
                            save = true;
                        }
                        break;
                    default:
                        break;
                }
                this.cfg[key] = curCfg;
            }
        }
        if (save) this.saveCfg();

        return this.cfg;

    }

    private setCfg<T extends keyof AppCfg>(key: T, value: AppCfg[T]) {
        return new Promise<void>((resolve, reject) => {
            chrome.storage.local.set({ [key]: value }, resolve)
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

        let find = (findWithPath = false) => {
            for (let copyFolderTo of this.allAccounts) {
                if (copyFolderTo.identities[0] && copyFolderTo.identities[0].email === email || email === "" && !copyFolderTo.identities[0]) {
                    let loop = (folders: browser.folders.MailFolder[], pathWithName: string): browser.folders.MailFolder => {

                        for (let curFolder of folders) {
                            let curPathName = pathWithName + '/' + curFolder.name;


                            if (curFolder.path === path || (findWithPath && curPathName === path)) {
                                return curFolder;
                            }
                            if (curFolder.subFolders) {
                                let findedFolder = loop(curFolder.subFolders, curPathName)
                                if (findedFolder) return findedFolder;
                            }
                        }
                    }
                    // let curPathName = !email ? "/" + email.replace(/@/g, '.') : "";
                    let findFolder = loop(copyFolderTo.folders, "");
                    if (findFolder) {
                        return findFolder;
                    }
                }
            }
        }

        let emailFolder = find();
        if (!emailFolder) {
            emailFolder = find(true)
        }
        return emailFolder;
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
        let getDefaultFolder = (acc: browser.accounts.MailAccount) => {
            let email = acc.identities[0] ? acc.identities[0].email : '';
            let loop = (subFolders: browser.folders.MailFolder[], prevTargetPath: string) => {

                subFolders.forEach((subFolder) => {
                    let curTargetPath = prevTargetPath + "/" + subFolder.name;

                    let copyFolder = false;//default true
                    let targetEmail = "";//default "";
                    if (this.cfg) {

                        targetEmail = this.cfg.defaultTargetEmail
                        copyFolder = this.cfg.defaultCopy;
                        if (email === '') copyFolder = false;


                    }

                    let _folder: FolderCopyTo = {
                        copyFolder: copyFolder,
                        email: email,
                        targetPath: curTargetPath,
                        folderName: subFolder.name,
                        folderPath: subFolder.path,
                        targetEmail: targetEmail
                    }
                    foldersCopyTo.push(_folder)


                    if (subFolder.subFolders) {
                        loop(subFolder.subFolders, curTargetPath);
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

            return foldersCopyTo;
        }
        this.allAccounts.forEach(getDefaultFolder);
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
