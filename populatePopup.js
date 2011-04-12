/*!
 * Facebook Wall Search
 *
 * Stephen Poletto 
 * http://www.astaticvoid.com
 *
 * Date: 9 Apr 2011
 */

var ready_state_interval = null;
var fbInvertedIndex = {};

function addKeywordFBObjPairToIndex(keyword, fbObject) {
	keyword = keyword.toLowerCase();
	keyword = stemmer(keyword);
	if (keyword in fbInvertedIndex) {
		if ($.inArray(fbObject, fbInvertedIndex[keyword]) == -1) {
			fbInvertedIndex[keyword].push(fbObject);
		}
	} else {
		fbInvertedIndex[keyword] = [];
		fbInvertedIndex[keyword].push(fbObject);
	}
}

function processStringAndAddToIndex(keywords, fbObject) {
	keywords = keywords.replace(/[^A-Za-z0-9]+/g, " ");
	keywords = keywords.split(' ');
	for (j = 0; j < keywords.length; j += 1) {
		addKeywordFBObjPairToIndex(keywords[j], fbObject);
	}
}

function buildInvertedIndex(fbData) {
	fbArray = JSON.parse(fbData);
	var i = 0;
	var j = 0;
	for (i = 0; i < fbArray.length; i += 1) {
		processStringAndAddToIndex(fbArray[i].body, fbArray[i]);
		for (j = 0; j < fbArray[i].comments.length; j += 1) {
			processStringAndAddToIndex(fbArray[i].comments[j].commentor, fbArray[i]);
			processStringAndAddToIndex(fbArray[i].comments[j].content, fbArray[i]);
		}
		processStringAndAddToIndex(fbArray[i].author, fbArray[i]);
		for (j = 0; j < fbArray[i].attachments.length; j += 1) {
			processStringAndAddToIndex(fbArray[i].attachments[j], fbArray[i]);
		}
	}
}

function displayResults(results, query) {
	var html = "<div id='searchresults'><h2> Results for search: " + query + "</h2>";
	if (results.length > 0) {
		html += "<div id='itemizedresults'><ul>";
		var i = 0;
		for (i = 0; i < results.length; i += 1) {			
			html += "<div id='result'><li> " + results[i].authorImg + "<p>" + results[i].author + ": " + results[i].body + "</p>";
			var j = 0;
			html += "<ol>";
			if (results[i].attachments.length > 0) {
				for (j = 0; j < results[i].attachments.length; j += 1) {
					html += results[i].attachments[j];
				}
			}
			html += "</ol>";
			if (results[i].comments.length > 0) {
				html += "<ul>";
				for (j = 0; j < results[i].comments.length; j += 1) {
					html += "<li> " + results[i].comments[j].commentorImg + "<p>" + results[i].comments[j].commentor + ": " + results[i].comments[j].content + "</p></li>";
				}
				html += "</ul></li>";
			}
			html += "</div>";
		}
		html += "</ul></div>";
	} else {
		html += "<p>No results found.</p></div>"
	}
	
	$("#content").html(html);
}

function processSearch() {
	var query = $("#searchform input[name=q]").val();
	
	// Need a ranking algorithm.
	
	// Find all instances of the query terms in the inverted index.
	allResults = [];
	queryKeywords = query.split(' ');
	var i = 0;
	for (i = 0; i < queryKeywords.length; i += 1) {
		currKeyword = queryKeywords[i].toLowerCase();
		currKeyword = stemmer(currKeyword);
		if (currKeyword in fbInvertedIndex) {
			fbObjects = fbInvertedIndex[currKeyword];
			var j = 0;
			for (j = 0; j < fbObjects.length; j += 1) {
				allResults.push(fbObjects[j]);
			}
		}
	}
	
	// Generate the HTML to display the results to the user.
	displayResults(allResults, query);
	return false;
}

function displayReadyState() {
	chrome.tabs.getSelected(null, function(tab) {
		if (tab.url.indexOf("facebook") != -1) {	
			chrome.tabs.sendRequest(tab.id, {action:"getFBPosts"}, function handler(response) {
				if (!response.canSearch) {
					$("#content").html("<p class='loading wrongsite'> Please navigate to your profile page to search your history. </p>");
				}
			
				var fbResponse = response.fbPosts;
				if (fbResponse != null && fbResponse != "") {
					buildInvertedIndex(fbResponse);
					// Clear the old loading screen.
					$("#content").empty();
					// Add the search field:
					$("#searchfield").html("<form id='searchform'><ul id='searchlist'><li><label for='query'>Search for:</label><span class='fieldbox'><input type='text' name='q'/></span></li></ul></form>");
					$("#searchform").submit(processSearch);
					clearInterval(ready_state_interval);
				}
			});
		} else {
	 		// User must not be at Facebook.com
	 		$("#content").html("<p class='loading wrongsite'> Please go to facebook.com to use this browser extension. </p>");
		}
	});
}

window.onload = function() {
	ready_state_interval = setInterval("displayReadyState()", 500);
}