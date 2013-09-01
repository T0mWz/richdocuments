/**
 * @license
 * Copyright (C) 2013 KO GmbH <copyright@kogmbh.com>
 *
 * @licstart
 * The JavaScript code in this page is free software: you can redistribute it
 * and/or modify it under the terms of the GNU Affero General Public License
 * (GNU AGPL) as published by the Free Software Foundation, either version 3 of
 * the License, or (at your option) any later version.  The code is distributed
 * WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
 * FITNESS FOR A PARTICULAR PURPOSE.  See the GNU AGPL for more details.
 *
 * As additional permission under GNU AGPL version 3 section 7, you
 * may distribute non-source (e.g., minimized or compacted) forms of
 * that code without the copy of the GNU GPL normally required by
 * section 4, provided you include this license notice and a URL
 * through which recipients can access the Corresponding Source.
 *
 * As a special exception to the AGPL, any HTML file which merely makes function
 * calls to this code, and for that purpose includes it by reference shall be
 * deemed a separate work for copyright law purposes. In addition, the copyright
 * holders of this code give you permission to combine this code with free
 * software libraries that are released under the GNU LGPL. You may copy and
 * distribute such a system following the terms of the GNU AGPL for this code
 * and the LGPL for the libraries. If you modify this code, you may extend this
 * exception to your version of the code, but you are not obligated to do so.
 * If you do not wish to do so, delete this exception statement from your
 * version.
 *
 * This license applies to this entire compilation.
 * @licend
 * @source: http://www.webodf.org/
 * @source: http://gitorious.org/webodf/webodf/
 */

/*global XMLHttpRequest, runtime, core, ops*/

define("webodf/editor/server/pullbox/Server", [], function () {
    "use strict";

    runtime.loadClass("core.Base64");
    runtime.loadClass("core.ByteArrayWriter");

    /**
     * @constructor
     * @implements ops.Server
     * @param {{url:string}} args
     */
    return function PullBoxServer(args) {

        var self = this,
            token,
            base64 = new core.Base64();

        args = args || {};
        args.url = args.url || "/WSER";
        args.sessionStateToFileUrl = args.sessionStateToFileUrl || "/SS2F"

        this.getGenesisUrl = function (sessionId) {
            return "/session/" + sessionId + "/genesis";
        };

        /**
         * @param {!Object} message
         * @param {!function(!string)} cb
         * @return {undefined}
         */
        function call(message, cb) {
            var xhr = new XMLHttpRequest(),
                byteArrayWriter = new core.ByteArrayWriter("utf8"),
                messageString = JSON.stringify(message),
                data;

            function handleResult() {
                if (xhr.readyState === 4) {
                    if ((xhr.status < 200 || xhr.status >= 300) && xhr.status === 0) {
                        // report error
                        runtime.log("Status " + String(xhr.status) + ": " +
                                xhr.responseText || xhr.statusText);
                    }
                    cb(xhr.responseText);
                }
            }
runtime.log("Sending message to server: "+messageString);
            // create body data for request from metadata and payload
            byteArrayWriter.appendString(messageString);
    //         byteArrayWriter.appendByteArray(zipData);
            data = byteArrayWriter.getByteArray();

            // do the request
            xhr.open('POST', args.url, true);
            xhr.onreadystatechange = handleResult;
            // ArrayBufferView will have an ArrayBuffer property, in WebKit, XHR can send()
            // an ArrayBuffer, In Firefox, one must use sendAsBinary with a string
            if (data.buffer && !xhr.sendAsBinary) {
                data = data.buffer; // webkit supports sending an ArrayBuffer
            } else {
                // encode into a string, this works in FireFox >= 3
                data = runtime.byteArrayToString(data, "binary");
            }
            try {
                if (xhr.sendAsBinary) {
                    xhr.sendAsBinary(data);
                } else {
                    xhr.send(data);
                }
            } catch (e) {
                runtime.log("Problem with calling server: " + e + " " + data);
                cb(e.message);
            }
        }

        this.call = call;

        this.getToken = function () {
            return token;
        };

        /**
         * for pre-authenticated use
         */
        this.setToken = function (a_token) {
            token = a_token;
        };


        /*jslint unparam: true*/
        /**
         * @param {!number} timeout in milliseconds
         * @param {!function(!string)} callback
         * @return {undefined}
         */
        this.connect = function (timeout, callback) {
            /*
            var accumulatedWaitingTime = 0;

            // already tried connecting?
            if (self.networkStatus() === "ready") {
                return;
            }
            */
            callback("ready");
        };
        /*jslint unparam: false*/

        /**
         * @return {!string}
         */
        this.networkStatus = function () {
            return "ready";
        };

        /**
         * @param {!string} login
         * @param {!string} password
         * @param {function(!Object)} successCb
         * @param {function(!string)} failCb
         * @return {undefined}
         */
        this.login = function (login, password, successCb, failCb) {
            call({
                command: "login",
                args: {
                    login: base64.toBase64(login),
                    password: base64.toBase64(password)
                }
            }, function(responseData) {
                var response = /**@type {{token:string}}*/(runtime.fromJson(responseData));
                runtime.log("Login reply: " + responseData);

                if (response.hasOwnProperty("token")) {
                    token = response.token;
                    runtime.log("Caching token: " + self.getToken());
                    successCb(response);
                } else {
                    failCb(responseData);
                }
            });
        };

        /**
         * @param {!string} userId
         * @param {!string} sessionId
         * @param {!function(!string)} successCb
         * @param {function()=} failCb
         * @return {undefined}
         */
        this.joinSession = function (userId, sessionId, successCb, failCb) {
            call({
                command: "join_session",
                args: {
                    user_id: userId,
                    es_id: sessionId
                }
            }, function(responseData) {
                var response = /**@type {{success:string, member_id:string}}*/(runtime.fromJson(responseData));
                runtime.log("join_session reply: " + responseData);

                if (response.hasOwnProperty("success") && response.success) {
                    successCb(response.member_id);
                } else {
                    if (failCb) {
                        failCb();
                    }
                }
            });
        };

        /**
         * @param {!string} sessionId
         * @param {!string} memberId
         * @param {!function()} successCb
         * @param {function()=} failCb
         * @return {undefined}
         */
        this.leaveSession = function (sessionId, memberId, successCb, failCb) {
            call({
                command: "leave_session",
                args: {
                    es_id: sessionId,
                    member_id: memberId
                }
            }, function(responseData) {
                var response = /**@type {{success:string, member_id:string}}*/(runtime.fromJson(responseData));
                runtime.log("leave_session reply: " + responseData);

                if (response.hasOwnProperty("success") && response.success) {
                    successCb();
                } else {
                    if (failCb) {
                        failCb();
                    }
                }
            });
        };

        /**
         * @param {!string} sessionId
         * @param {!string} memberId
         * @param {!string} seqHead
         * @param {function()=} callback
         * @return {undefined}
         */
        this.writeSessionStateToFile = function(sessionId, memberId, seqHead, fileData, callback) {
            // code copied from BrowserRuntime.writeFile and adapted
            var xhr = new XMLHttpRequest();

            function handleResult() {
                if (xhr.readyState === 4) {
                    if (xhr.status === 0 && !xhr.responseText) {// TODO: check makes sense here as well?
                        // for local files there is no difference between missing
                        // and empty files, so empty files are considered as errors
                        runtime.log("File " + args.sessionStateToFileUrl + " is empty.");
                    } else if ((xhr.status >= 200 && xhr.status < 300) ||
                            xhr.status === 0) {
                        // report success
                        runtime.log(null);
                    } else {
                        // report error
                        runtime.log("Status " + String(xhr.status) + ": " +
                                xhr.responseText || xhr.statusText);
                    }
                    callback();
                }
            }

            // do the request
            xhr.open('POST', args.sessionStateToFileUrl, true);
            xhr.setRequestHeader("webodf-session-id", sessionId);
            xhr.setRequestHeader("webodf-member-id", memberId);
            xhr.setRequestHeader("webodf-session-revision", seqHead);
            xhr.onreadystatechange = handleResult;
            // ArrayBufferView will have an ArrayBuffer property, in WebKit, XHR can send()
            // an ArrayBuffer, In Firefox, one must use sendAsBinary with a string
            if (fileData.buffer && !xhr.sendAsBinary) {
                fileData = fileData.buffer; // webkit supports sending an ArrayBuffer
            } else {
                // encode into a string, this works in FireFox >= 3
                fileData = runtime.byteArrayToString(fileData, "binary");
            }
            try {
                if (xhr.sendAsBinary) {
                    xhr.sendAsBinary(fileData);
                } else {
                    xhr.send(fileData);
                }
            } catch (e) {
                runtime.log("Problem with calling \"writeSessionStateToFile\" on server");
                callback(e.message);
            }
        };
    };
});
