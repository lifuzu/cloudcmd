var CloudCmd, Util, DOM, CloudFunc, Github, cb;

(function(CloudCmd, Util, DOM, CloudFunc) {
    'use strict';
    
    CloudCmd.GitHub     = GitHubProto;
    
    function GitHubProto(callback) {
        var GitHub  = this,
            Storage = DOM.Storage,
            
            GH,
            User;
        
        cb = function (err, data) { Util.log(err || data);};
        
        function init(pCallBack) {
            Util.loadOnLoad([
                load,
                GitHub.autorize,
                GitHub.getUserData,
                Util.retExec(pCallBack)
            ]);
            
            GitHub.callback = function() {
                Util.loadOnLoad([
                    GitHub.getUserData,
                    Util.retExec(pCallBack)
                ]);
            };
        }
        
        function load(callback) {
            var dir     = CloudCmd.LIBDIRCLIENT + 'storage/github/',
                files   =  [
                    dir + 'lib/underscore.js',
                    dir + 'lib/base64.js',
                    dir + 'github.js'
                    
                ],
                url     = CloudFunc.getJoinURL(files);
            
            Util.time('github');
            
            DOM.jsload(url, function() {
                Util.timeEnd('github');
                DOM.Images.hideLoad();
                
                Util.exec(callback);
            });
        }
        
        
        GitHub.autorize            = function(pCallBack, pCode) {
            var lCode, lToken = Storage.get('token');
            
            if (lToken) {
                GitHub.Login(lToken);
                Util.exec(pCallBack);
            }
            else {
                lCode = pCode || window.location.search;
                
                if (lCode || Util.isContainStr(lCode, '?code=') )
                    CloudCmd.getConfig(function(pConfig) {
                        DOM.ajax({
                            type    : 'put',
                            url     : pConfig && pConfig.apiURL + '/auth',
                            data    : Util.removeStr(lCode, '?code='),
                            success : function(pData) {
                                if (pData && pData.token) {
                                    lToken = pData.token;
                                    
                                    GitHub.Login(lToken);
                                    Storage.set('token', lToken);
                                    Util.exec(pCallBack);
                                }
                                else
                                    Util.log('Worning: token not getted...');
                            }
                        });
                    });
                else{
                    var lUrl = '//' + window.location.host + '/auth/github';
                    DOM.openWindow(lUrl);
                }
            }
        };
        
        GitHub.getUserData         = function(pCallBack) {            
            User.show(null, function(pError, pData) {
                if (!pError) {
                    var lName  = pData.name;
                    Util.log('Hello ' + lName + ' :)!');
                }
                else
                    DOM.Storage.remove('token');
            });
            
            Util.exec(pCallBack);
        };
        
        /* PUBLIC FUNCTIONS */
        GitHub.basicLogin          = function(pUser, pPasswd) {
            GH = new Github({
                username: pUser,
                password: pPasswd,
                auth    : 'basic'
            });
        };
        
        GitHub.Login               = function(pToken) {
            GH = new Github({
                token   : pToken,
                auth    : 'oauth'
            });
            
            User = GH.getUser();
        };
        
        /**
         * function creates gist
         */
        GitHub.uploadFile      = function(pParams, pCallBack) {
            var lContent    = pParams.data,
                lName       = pParams.name;
            
            if (lContent) {
                DOM.Images.showLoad();
                if (!lName)
                    lName = Util.getDate();
                
                var lGist       = GH.getGist(),
                    lFiles      = {},
                    lHost       = CloudCmd.HOST,
                    lOptions    = {
                        description: 'Uplouded by Cloud Commander from ' + lHost,
                        public: true
                    };
                
                lFiles[lName] ={
                    content: lContent
                };
                
                lOptions.files = lFiles;
                
                lGist.create(lOptions, function(pError, pData) {
                    DOM.Images.hideLoad();
                    Util.log(pError || pData);
                    Util.log(pData && pData.html_url);
                    
                    Util.exec(pCallBack);
                });
            }
            
            return lContent;
        };
        
        init(callback);
    }
})(CloudCmd, Util, DOM, CloudFunc);
