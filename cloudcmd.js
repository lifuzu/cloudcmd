(function() {
    'use strict';
    
    var DIR         = __dirname     + '/',
        main        = require(DIR   + 'lib/server/main'),
        
        LIBDIR      = main.LIBDIR,
        SRVDIR      = main.SRVDIR,
        CLIENTDIR   = LIBDIR + 'client',
        HTMLDIR     = main.HTMLDIR,
        JSONDIR     = main.JSONDIR,
        
        path        = main.path,
        fs          = main.fs,
        files       = main.files,
        CloudFunc   = main.cloudfunc,
        AppCache    = main.appcache,
        Util        = main.util,
        update      = main.update,
        
        server      = main.librequire('server'),
        Minify      = main.minify,
        Config      = main.config,
        
        INDEX_PATH  = HTMLDIR + 'index.html',
        CONFIG_PATH = JSONDIR + 'config.json',
        
        KEY         = DIR + 'ssl/ssl.key',
        CERT        = DIR + 'ssl/ssl.crt',
        
        FILE_TMPL   = HTMLDIR + 'file.html',
        PANEL_TMPL  = HTMLDIR + 'panel.html',
        PATH_TMPL   = HTMLDIR + 'path.html',
        LINK_TMPL   = HTMLDIR + 'link.html',
        
        FileTemplate, PanelTemplate, PathTemplate, LinkTemplate,
        
        FS          = CloudFunc.FS;
        /* reinit main dir os if we on Win32 should be backslashes */
        DIR         = main.DIR;
    
    readConfig(init);
    
    
    /**
     * additional processing of index file
     */
    function indexProcessing(options) {
        var keysPanel, left, right,
            LEFT    = CloudFunc.PANEL_LEFT,
            RIGHT   = CloudFunc.PANEL_RIGHT,
            data    = options.data,
            panel   = options.panel;
        
        if (!Config.appCache)
            data = Util.removeStr(data, [
                /* min */
                ' manifest=/cloudcmd.appcache',
                /* normal */
                ' manifest="/cloudcmd.appcache"'
            ]);
        
        if (!Config.showKeysPanel) {
            lKeysPanel  = '<div class="keyspanel';
            data        = data.replace(keysPanel + '"', keysPanel +' hidden"');
        }
        
        left    = Util.render(PanelTemplate, {
            id      : LEFT,
            side    : 'left',
            content : panel
        });
        
        right    = Util.render(PanelTemplate, {
            id      : RIGHT,
            side    : 'right',
            content : panel
        });
        
        data = Util.render(data, {
            title   : CloudFunc.getTitle(),
            fm      : left + right
        });
        
        return data;
        
    }
    
    /**
     * init and process of appcache if it allowed in config
     */
    function appCacheProcessing() {
        var lFONT_REMOTE    = '//themes.googleusercontent.com/static/fonts/droidsansmono/v4/ns-m2xQYezAtqh7ai59hJUYuTAAIFFn5GTWtryCmBQ4.woff',
            lFONT_LOCAL     = './font/DroidSansMono.woff',
            lJQUERY_REMOTE  = '//ajax.googleapis.com/ajax/libs/jquery/2.0.0/jquery.min.js',
            lJQUERY_LOCAL   = './lib/client/jquery.js',
            lFiles          = [{}, {}];
            
            lFiles[0][lFONT_REMOTE]     = lFONT_LOCAL;
            lFiles[1][lJQUERY_REMOTE]   = lJQUERY_LOCAL;
        
        AppCache.addFiles(lFiles);
        AppCache.createManifest();
    }
    
    
    function init() {
        var lServerDir,  lArg, lParams, lFiles;
        
        if (update)
            update.get();
        
        /* Determining server.js directory
         * and chang current process directory
         * (usually /) to it.
         * argv[1] - is always script name
         */
        lServerDir = path.dirname(process.argv[1]) + '/';
        
        if (DIR !== lServerDir) {
            Util.log('current dir: ' + DIR);
            process.chdir(lServerDir);
        }
        
        Util.log('server dir: ' + lServerDir);
        
        /* if command line parameter testing resolved 
         * setting config to testing, so server
         * not created, just init and
         * all logs writed to screen */
        lArg = process.argv;
        lArg = lArg[lArg.length - 1];
        
        if ( lArg === 'test' ||  lArg === 'test\r') {
            Util.log(process.argv);
            Config.server  = false;
        }
        
        if (Config.logs) {
            Util.log('log param setted up in config.json\n' +
                'from now all logs will be writed to log.txt');
            writeLogsToFile();
        }
        
        lParams = {
            appcache    : appCacheProcessing,
            rest        : main.rest,
            route       : route
        },
        
        lFiles = [FILE_TMPL, PANEL_TMPL, PATH_TMPL, LINK_TMPL];
        
        if (Config.ssl)
            lFiles.push(KEY, CERT);
        
        files.read(lFiles, 'utf-8', function(pErrors, pFiles) {
            if (pErrors)
                Util.log(pErrors);
            else {
                FileTemplate    = pFiles[FILE_TMPL];
                PanelTemplate   = pFiles[PANEL_TMPL];
                PathTemplate    = pFiles[PATH_TMPL];
                LinkTemplate    = pFiles[LINK_TMPL];
                
                if (Config.ssl)
                    lParams.ssl = {
                        key     : pFiles[KEY],
                        cert    : pFiles[CERT]
                    };
                
                server.start(lParams);
            }
        });
    }
    
    function readConfig(callback) {
        fs.readFile(CONFIG_PATH, 'utf8', function(error, data) {
            var msg, status, readed;
            
            if (error) 
                status = 'error';
            else {
                status = 'ok';
                readed = Util.parseJSON(data);
                
                main.config = Config = readed;
            }
                
            msg = CloudFunc.formatMsg('read', 'config', status);
            Util.log(msg);
            
            Util.exec(callback);
        });
    }
    
    /**
     * routing of server queries
     */
    function route(request, response, callback) {
        var ret, name, params, isAuth, isFS;
        
        if (request && response) {
            ret     = true;
            name    = main.getPathName(request);
            isAuth  = Util.strCmp(name, ['/auth', '/auth/github']);
            isFS    = Util.strCmp(name, '/') || Util.isContainStrAtBegin(name, FS);
            
            params  = {
                request     : request,
                response    : response,
                name        : name
            };
            
            if (isAuth) {
                Util.log('* Routing' + '-> ' + name);
                
                params.name = main.HTMLDIR + name + '.html';
                main.sendFile(params);
            } else if (isFS)
                sendContent(params);
            else {
                ret = false;
                Util.exec(callback);
            }
        }
        
        return ret;
    }
    
    function sendContent(pParams) {
        var p, lRet = main.checkParams(pParams);
        
        if (lRet) {
            p       = pParams;
            p.name  = Util.removeStrOneTime(p.name, CloudFunc.FS) || main.SLASH;
            
            fs.stat(p.name, function(error, stat) {
                if (error)
                    main.sendError(pParams, error);
                else
                    if (stat.isDirectory())
                        processContent(pParams);
                    else
                        main.sendFile(pParams);
           });
        }
        
        return lRet;
    }
    
    function processContent(params) {
        var p       = params,
            ret     = main.checkParams(params);
        
        if (ret)
            main.commander.getDirContent(p.name, function(error, json) {
                var query, isJSON;
                
                if (error) 
                    main.sendError(params, error);
                else {
                    query       = main.getQuery(p.request);
                    isJSON      = Util.isContainStr(query, 'json');
                    
                    if (!isJSON) 
                        readIndex(json, params);
                    else {
                        p.data  = Util.stringifyJSON(json);
                        p.name +='.json';
                        main.sendResponse(params, null, true);
                    }
                }
            });
    }
    
    function readIndex(pJSON, params) {
        var p = params;
        
        Util.ifExec(!Minify, function(params) {
            var name = params && params.name;
            
            fs.readFile(name || INDEX_PATH, 'utf8', function(error, template) {
                var panel,
                    config  = main.config,
                    minify  = config.minify;
                
                if (error)
                    main.sendError(p, error);
                else {
                    p.name  = INDEX_PATH,
                    panel  = CloudFunc.buildFromJSON(pJSON, FileTemplate, PathTemplate, LinkTemplate),
                    
                    main.sendResponse(p, indexProcessing({
                        panel   : panel,
                        data    : template,
                    }), true);
                }
            });
        },  function(callback) {
                Minify.optimize(INDEX_PATH, {
                    callback    : callback,
                    returnName  : true
                });
        });
    }
    
    
    /* function sets stdout to file log.txt */
    function writeLogsToFile() {
        var stdout      = process.stdout,
            writeFile   = fs.createWriteStream('log.txt'),
            write       = writeFile.write.bind(writeFile);
        
        stdout.write    = write;
    }
})();