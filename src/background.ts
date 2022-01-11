interface FolderCopyTo {
    email: string;
    folderPath: string;
    targetPath: string;
    targetEmail: string;
    copyFolder: boolean;
    defaultTargetFolder: boolean;
    folderName: string;
}


interface AppCfg {
    activeBackup: boolean,
    reloadtime: number,
    targetCopyFolders: FolderCopyTo[]
}


class AppBackup {
    listenersReceiveMsg: void;
    interval: any;


    private async copyEmails(destinyFolder: browser.folders.MailFolder, originFolder: browser.folders.MailFolder) {
        let destinyMsgs = await this.getAllMessagesFolder(destinyFolder);
        let originMsgs = await this.getAllMessagesFolder(originFolder);
        for (let email of originMsgs)
            if (!this.containEmail(email, destinyMsgs)) {
                await browser.messages.copy([email.id], destinyFolder)
                browser
            }

    }
    private containEmail(email: browser.messages.MessageHeader, localMsgs: browser.messages.MessageHeader[]) {
        for (let localEmail of localMsgs) {

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
        let messages: browser.messages.MessageHeader[] = [];
        let page = await browser.messages.list(folder);
        messages = messages.concat(page.messages);
        while (page.id) {
            page = await browser.messages.continueList(page.id);
            messages = messages.concat(page.messages);
        }
        return messages;
    }


    async loadFolderCopyTo() {
        return new Promise<void>(async (resolve, reject) => {
            (await this.getAllEmailFolders()).forEach(async (f) => {


                let ac = await this.getAccountById(f.accountId);
                let email = ac.identities[0] ? ac.identities[0].email : "";

                let folderCopyTo = this.getFolderCopyTo(email, f.path);

                if (!folderCopyTo) {
                    await this.getDefaultFolderCopyTo(email, f.path, true);

                }




            })
            //deletar folderCopyTo que não tenham pasta correspondente
            for (let f of (await this.getCfg()).targetCopyFolders.concat()) {
                let a = this.getEmailFolder(f.email, f.folderPath);
                if (!a) {
                    for (let ff of (await this.getCfg()).targetCopyFolders.concat()) {
                        if (ff.targetEmail === f.folderPath && ff.targetEmail === f.email) {
                            ff.copyFolder = false;
                            ff.defaultTargetFolder = false;
                            ff.targetEmail = "";
                            ff.targetPath = "";
                            this.deleteFolderCopyTo(ff);
                        }
                    }

                    this.deleteFolderCopyTo(f);
                }
            }
            resolve();
        })
    }

    public async checkFolders() {
        await this.loadFolderCopyTo();
        let time = new Date().getTime();
        let localAccount = await this.getLocalAccount();
        let cfg = await this.getCfg();
        let externalAccounts = await this.getExternalAccounts();
        console.log(browser.i18n.getMessage("startBackup"));
        if (localAccount.identities.length > 0) return;


        if (externalAccounts.length > 0) {

            for (let copyFolderTo of cfg.targetCopyFolders) {
                if (copyFolderTo.copyFolder && copyFolderTo.email !== "") {
                    let originFolder = await this.getEmailFolder(copyFolderTo.email, copyFolderTo.folderPath);
                    let destinyFolder: browser.folders.MailFolder;
                    if (copyFolderTo.defaultTargetFolder) {
                        let defaultFolderCopyTo = await this.getDefaultFolderCopyTo(copyFolderTo.email, copyFolderTo.folderPath);
                        destinyFolder = await this.getEmailFolder(defaultFolderCopyTo.targetEmail, defaultFolderCopyTo.targetPath);
                        if (!destinyFolder) {
                            let folders = Array.from(defaultFolderCopyTo.targetPath.split('/'));
                            folders.shift();
                            for (let folderName of folders) {
                                let curFindFolder: browser.folders.MailFolder;
                                if (!destinyFolder) {
                                    destinyFolder = { path: '/', accountId: localAccount.id };
                                    curFindFolder = await this.getEmailFolder("", destinyFolder.path + folderName);
                                } else {
                                    curFindFolder = await this.getEmailFolder("", destinyFolder.path + "/" + folderName);
                                }

                                if (!curFindFolder) {
                                    destinyFolder = await browser.folders.create(destinyFolder, folderName);
                                } else {
                                    destinyFolder = curFindFolder;
                                }
                                await this.getEmailFolder(copyFolderTo.targetEmail, copyFolderTo.targetPath);
                            }
                        }
                    } else {
                        destinyFolder = await this.getEmailFolder(copyFolderTo.targetEmail, copyFolderTo.targetPath);
                    }
                    await this.copyEmails(destinyFolder, originFolder);
                }


            }

            console.log(browser.i18n.getMessage("endBackupIn") + " " + (new Date().getTime() - time) + " " + browser.i18n.getMessage("milliseconds"));
        }

    }
    constructor() {
        this.start()
    }


    async getExternalAccounts() {
        let externalAccounts = await this.getAllAccounts();
        return externalAccounts.filter((email, i, arr) => {
            return email.identities[0] ? true : false;

        });
    }

    async getAllAccounts() {
        return await browser.accounts.list();
    }

    async getLocalAccount() {
        let externalAccounts = await this.getAllAccounts();
        return externalAccounts.filter((email, i, arr) => {
            return email.identities[0] ? false : true;
        })[0];// assumir que a pasta local não possúi email
    }



    private async start() {
        // await this.resetCfg();
        await this.loadFolderCopyTo();
        let cfg = await this.getCfg();

        if (cfg.activeBackup) {
            this.interval = setInterval(() => this.checkFolders(), 1000 * 60 * cfg.reloadtime);
            browser.messages.onNewMailReceived.addListener(this.checkFolders);
            this.checkFolders();
        }
    }
    listenerMsg: (folder: browser.folders.MailFolder, messages: browser.messages.MessageList) => void;
    async dataChanged(cfg: AppCfg) {
        await this.saveCfg(cfg);
        if (cfg.activeBackup) {
            await this.checkFolders();
            if (this.interval) {
                clearInterval(this.interval);
            }
            this.interval = setInterval(() => this.checkFolders(), 1000 * 60 * cfg.reloadtime);

            if (this.listenerMsg) {
                browser.messages.onNewMailReceived.removeListener(this.listenerMsg);
            } else {
                this.listenerMsg = (a, b) => { this.checkFolders(); }
            }
            browser.messages.onNewMailReceived.addListener(this.listenerMsg);

        } else {
            if (this.interval) {
                clearInterval(this.interval);
                this.interval = null;
            }
            if (this.listenerMsg) {
                browser.messages.onNewMailReceived.removeListener(this.listenerMsg);
                this.listenerMsg = null;
            }
        }
    }

    async saveCfg(cfg: AppCfg) {
        return await new Promise<void>((resolve, reject) => {
            chrome.storage.sync.set({
                cfg: cfg
            }, resolve);
        })
    }

    async resetCfg() {
        return await new Promise<void>((resolve, reject) => {
            chrome.storage.sync.remove("cfg", resolve);
        })
    }

    private async getDefaultCfg(): Promise<AppCfg> {
        return {
            activeBackup: false,
            reloadtime: 20,
            targetCopyFolders: await this.generateDefaultTargeFolders(),
        }
    }

    async getCfg() {
        return await new Promise<AppCfg>((resolve, reject) => {
            chrome.storage.sync.get(async (itens: { cfg: AppCfg }) => {
                let defaultCfg = await this.getDefaultCfg();
                if (!itens || !itens.cfg) {
                    await this.saveCfg(defaultCfg)
                    resolve(<AppCfg>defaultCfg)
                } else {
                    let save = false;
                    if (typeof itens.cfg.activeBackup !== 'boolean') {
                        itens.cfg.activeBackup = defaultCfg.activeBackup;
                        save = true;
                    }
                    if (typeof itens.cfg.reloadtime !== 'number') {
                        itens.cfg.reloadtime = defaultCfg.reloadtime;
                        save = true;
                    }
                    if (!Array.isArray(itens.cfg.targetCopyFolders) || itens.cfg.targetCopyFolders.length === 0) {
                        itens.cfg.targetCopyFolders = defaultCfg.targetCopyFolders;
                        save = true;
                    }
                    if (save) await this.saveCfg(itens.cfg);
                    resolve(<AppCfg>itens.cfg)
                }

            });
        })
    }


    async getAllEmailFolders() {
        let accs = await this.getAllAccounts();
        let emailFolders: browser.folders.MailFolder[] = [];
        for (let acc of accs) {
            let loop = (folders: browser.folders.MailFolder[]) => {
                for (let curFolder of folders || []) {
                    emailFolders.push(curFolder);
                    loop(curFolder.subFolders)
                }

            }
            loop(acc.folders);

        }
        return emailFolders;
    }

    async getAccountById(id: string) {
        let accs = await this.getAllAccounts();
        for (let acc of accs) {
            if (acc.id === id) {
                return acc;
            }
        }
        return null;
    }
    async getAccountByEmail(email: string) {
        let accs = await this.getAllAccounts();
        for (let acc of accs) {
            if (acc.identities[0] && acc.identities[0].email === email || !acc.identities[0] && email === "") {
                return acc;
            }
        }
        return null;
    }

    async getEmailFolder(email: string, path: string) {
        let accs = await this.getAllAccounts();
        for (let copyFolderTo of accs) {
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


    async getFolderCopyTo(email: string, path: string) {
        let cfg = await this.getCfg();
        for (let copyFolderTo of cfg.targetCopyFolders) {
            if (copyFolderTo.folderPath === path && copyFolderTo.email === email) {
                return copyFolderTo;
            }
        }
        return null;
    }

    async updateFolderCopyTo(folderCopyTo: FolderCopyTo) {
        let cfg = await this.getCfg();
        cfg.targetCopyFolders.forEach(async (copyFolderTo, index) => {
            if (copyFolderTo.folderPath === folderCopyTo.folderPath && copyFolderTo.email === folderCopyTo.email) {
                cfg.targetCopyFolders[index] = folderCopyTo;
                await this.saveCfg(cfg);
            }
        });
    }
    async deleteFolderCopyTo(folderCopyTo: FolderCopyTo) {
        let cfg = await this.getCfg();
        cfg.targetCopyFolders.forEach(async (copyFolderTo, index) => {
            if (copyFolderTo.folderPath === folderCopyTo.folderPath && copyFolderTo.email === folderCopyTo.email) {
                cfg.targetCopyFolders.splice(index, 1);
                await this.saveCfg(cfg);
            }
        });
    }

    async getOrCreateFolderCopyTo(email: string, targetPath: string, folderPath: string, copyFolder: boolean, folderName: string, targetEmail: string) {
        let folderCopyTo = (await this.getFolderCopyTo(email, targetPath));
        if (!folderCopyTo) {
            let cfg = await this.getCfg();
            folderCopyTo = {
                copyFolder: copyFolder,
                email: email,
                folderName: folderName,
                targetPath: targetPath,
                defaultTargetFolder: true,
                folderPath: folderPath,
                targetEmail: targetEmail
            };
            cfg.targetCopyFolders.push(folderCopyTo);
            await this.saveCfg(cfg);
        }
        return folderCopyTo;
    }




    async generateDefaultTargeFolders() {
        let foldersCopyTo: FolderCopyTo[] = [];
        (await browser.accounts.list()).forEach((acc) => {
            let email = acc.identities[0] ? acc.identities[0].email : '';
            let loop = (subFolders: browser.folders.MailFolder[], targetFolderPath: string) => {
                subFolders.forEach((subFolder) => {
                    let curTargetFolderPath = targetFolderPath + "/" + subFolder.name

                    foldersCopyTo.push({
                        copyFolder: true,
                        email: email,
                        targetPath: curTargetFolderPath,
                        folderName: subFolder.name,
                        defaultTargetFolder: true,
                        folderPath: subFolder.path,
                        targetEmail: ""
                    })
                    if (subFolder.subFolders) {
                        loop(subFolder.subFolders, curTargetFolderPath);
                    }
                });
            }
            let path = '/' + email.replace(/@/g, '.');
            loop(acc.folders, path);
        });
        return foldersCopyTo;
    }

    async getDefaultFolderCopyTo(email: string, path: string, create?: boolean) {
        for (let defaultFolderCopyTo of (await this.generateDefaultTargeFolders())) {
            if (defaultFolderCopyTo.email === email && defaultFolderCopyTo.folderPath === path) {
                if (create) {
                    await this.getOrCreateFolderCopyTo(defaultFolderCopyTo.email, defaultFolderCopyTo.targetPath, defaultFolderCopyTo.folderPath, defaultFolderCopyTo.copyFolder, defaultFolderCopyTo.folderName, defaultFolderCopyTo.targetEmail);
                }
                return defaultFolderCopyTo;
            }

        }
        return null;
    }



}
var appBackup = new AppBackup();
