var log = require("../../lib/logger.js"),
    SbError = require("../../lib/SbError.js"),
	fs = require("fs"),
	blockWords={},
	longest = 0,
    search = require('./searchPattern'),
    suffixArray = require('./suffixArray.js'),
    separators = /[ \t,\:\.]/;

module.exports = function(core) {

	init();
	core.on('text', function(message, callback) {
		var room = message.room, text, customWords, index, l;
		log("Heard \"text\" event");
		text = message.text;
		if(room.params && room.params.antiAbuse && room.params.antiAbuse.spam) {
			if (room.params.antiAbuse.block && room.params.antiAbuse.block.english) {
				if (rejectable(text)) {
					message.labels.abusive = 1;
					log(message);
					return callback();
				}
			}

			if (message.room.params.antiAbuse.customPhrases) {
				customPhrases = message.room.params.antiAbuse.customPhrases;
				textMessage = message.text;
                textArray = suffixArray(textMessage);
                for (var i = 0;i < customPhrases.length;i++) {
                    var phrase = customPhrases[i];
                    var r = search(textMessage, textArray, phrase);
                    if (r >= 0 && isSeperated(text, r, r + phrase.length - 1)) {
                        log.d("Found phrase: ", phrase);
                        message.labels.abusive = 1;
                        return callback();
                    }
                };
			}
		}
		return callback();
	}, "antiabuse");

    function isSeperated(text, in1, in2) {
        log.d("Sep:", text, in1, in2);
        var r1 = in1 === 0;
        var r2 = in2 === text.length - 1;
        if (!r1) r1 = separators.test(text.charAt(in1 - 1));
        if (!r2) r2 =  separators.test(text.charAt(in2 + 1));
        log.d("Return:", (r1 && r2));
        return r1 && r2;
    }

	core.on("room", function(action, callback){
		var room  = action.room;
        var text = room.id + (room.description ? (" " + room.description) : "");
		if (rejectable(text)) return callback(new SbError("Abusive_room_name"));
		callback();
	}, "antiabuse");

	core.on("room", function(action, callback) {
		var limit = 10000;
        log.d("room action:", JSON.stringify(action));
        if (action.room.params && action.room.params.antiAbuse) {
			var a = action.room.params.antiAbuse.customPhrases;
			var l = 0;
            if (a instanceof Array) {
				var na = [];
				a.forEach(function(sentance) {
				    l += sentance.length;
				    if (l > limit) {
                        return callback(new Error("ERR_LIMIT_NOT_ALLOWED"));
                    }
                });
                callback();
			} else {
				callback(new Error("INVALID_WORDBLOCK"));
			}
		} else callback();
	}, "appLevelValidation");
};



var init=function(){
	fs.readFile(__dirname + "/blockedWords.txt","utf-8", function (err, data) {
		if (err) throw err;

		data.split("\n").forEach(function(word) {
			if (word) {
				word.replace(/\@/g,'a');
				word.replace(/\$/g,'s');

				word = word.replace(/\W+/, ' ').toLowerCase().trim();
				if (word.length===0) {
					return;
				}
				if (word.length > longest) {
					longest = word.length;
				}
				blockWords[word] = true;
			}
		});
	});

};

var rejectable = function(text) {
    log.d("text:", text);
	var i, l, j, words, phrase;
	words=text.replace(/\@/g,'a').replace(/\$/g,'s');
	words = words.toLowerCase().split(/\W+/);

	for(i=0,l=words.length-1;i<l;i++) {
		phrase = words[i];
		for (j=i+1; j<=l; j++) {
			phrase = phrase + ' ' + words[j];
			if (phrase.length <= longest) {
				words.push(phrase);
			}
		}
	}

	for(i=0,l=words.length;i<l;i++) {
		if (blockWords[words[i]]) {
			log("found the word " + words[i]+"---");
			return true;
		}
	}
};

