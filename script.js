/*!
 * Facebook Wall Search
 *
 * Stephen Poletto 
 * http://www.astaticvoid.com
 *
 * Date: 9 Apr 2011
 */
 
var loading_in_process = true;
var pager_interval = null;
var profile_view_interval = null;
var fullFeed = "";
 
function grabImageHTMLForAuthor(author) {
	console.log(author);
	hovercard = $(author).attr("data-hovercard");
	// Shift index up by three to ignore 'id='
	idIndex = hovercard.indexOf("id") + 3;
	userID = hovercard.slice(idIndex);
	return "<img src='http://graph.facebook.com/" + userID + "/picture' />";
}
 
function removeHTMLTags(rawHTML){
	rawHTML = rawHTML.replace(/&(lt|gt);/g, function (strMatch, p1){
		return (p1 == "lt")? "<" : ">";
	});
	rawHTML = rawHTML.replace(/<br>/g, '\n');
	return rawHTML.replace(/<\/?[^>]+(>|$)/g, "");
}
 
/* Write out the wall data to localstorage.
 */ 
function cacheFBWall(didReadToEnd) {
	/* The cache needs to contain if it was able to go all
	 * the way back or not and the last post added. From these,
	 * we can identify what new data to add to the cache.
	 */
	
	var jsonArray = [];
	
	var storyContent = $(fullFeed).find('.storyContent');
	$.each(storyContent, function(index, value) {
		var originalPost = $(value).find('.messageBody');
		var body = "";
		if (originalPost.length > 0) {
			body = removeHTMLTags(originalPost[0].innerHTML);		
		}
		var author = "";
		var authorImg = "";
		var authorDiv = $(value).find('.actorName.actorDescription');
		if (authorDiv.length > 0) {
			authorDiv = authorDiv[0].innerHTML;
			authorImg = grabImageHTMLForAuthor(authorDiv);
			author = $(authorDiv).html();
		}
		
		var date = "";
		var dateAbbr = $(value).find('span.uiStreamFooter abbr');
		if (dateAbbr.length > 0) {
			// The first date we see will be for the original post.
			date = $(dateAbbr[0]).attr('data-date');
		}
		
		var attachments = [];
		var attachmentDiv = $(value).find('.uiAttachmentTitle');
		$.each(attachmentDiv, function(index, attachment) {
			attachments.push(attachment.innerHTML);
		});
		
		var comments = [];
		var commentDiv = $(value).find('.commentContent');
		$.each(commentDiv, function(index, comment) {
			var commentorImg = grabImageHTMLForAuthor($(comment).children('.actorName')[0]);
			var commentor = $(comment).children('.actorName')[0].innerHTML;
			var content = $(comment).children("span")[0].innerHTML;
			comments.push({"commentor" : commentor, "commentorImg" : commentorImg, "content" : content});
		});
		if (body != "" && author != "") {
			jsonArray.push({"body": body, "author" : author, "authorImg" : authorImg, "date" : date, "attachments" : attachments, "comments" : comments});
		}
	});
		
	// If we read everyting on the user's profile page, just write it all to the
	// cache, regardless of whether there's already stuff in the cache:
	if (didReadToEnd) {
		localStorage.removeItem('cache');
		localStorage.cache = JSON.stringify(jsonArray);
	} else {
		// We're only going to write out entries that are more recent than what's already in
		// the cache.
		if ("cache" in localStorage) {
			newCache = [];
			oldCache = JSON.parse(localStorage.cache);
			if (oldCache.length > 0) {
				var latest = oldCache[0];
				var dateOfCache = dateObjectFromFBRepresentation(latest.date);
				var i = 0;
				for (i = 0; i < jsonArray.length; i += 1) {
					var currDate = dateObjectFromFBRepresentation(jsonArray[i].date);
					if (currDate <= dateOfCache) {
						// We're older than the cache. We're done.
						break;
					}
					newCache.push(jsonArray[i]);
				}
				newCache = newCache.concat(oldCache);
				localStorage.removeItem('cache');
				localStorage.cache = JSON.stringify(newCache);
			} else {
				localStorage.cache = JSON.stringify(jsonArray);
			}
		} else {
			localStorage.cache = JSON.stringify(jsonArray);
		}
	}
	loading_in_process = false;
}
 
/* Since the user could bail and migrate to
 * another page at any given time, we want to be
 * constantly updating our record of the user's
 * wall feed. We'll wait to actually cache until
 * we reach the end of their feed, they leave 
 * the page or they close their browser.
 */
function updateCurrentFBWallContents() {
	fullFeed = $('#profile_minifeed').html();
}
 
function monthAbbrToMonthNumber(monthAbbr) {
	switch(monthAbbr) {
		case "Jan":
			return 0;
		case "Feb":
			return 1;
		case "Mar":
			return 2;
		case "Apr":
			return 3;
		case "May":
			return 4;
		case "Jun":
			return 5;
		case "Jul":
			return 6;
		case "Aug":
			return 7;
		case "Sep":
			return 8;
		case "Oct":
			return 9;
		case "Nov":
			return 10;
		case "Dec":
			return 11;
		default:
			return -1;
	}
}
 
/* Takes a date string of the form:
 * Sat, 09 Apr 2011 00:58:17 -0700
 * and creates a javascript date object.
 */
function dateObjectFromFBRepresentation(fbDate) {
	dateComponents = fbDate.split(' ');
	day = parseInt(dateComponents[1], 10);
	month = monthAbbrToMonthNumber(dateComponents[2], 10);
	year = parseInt(dateComponents[3], 10);
	timeComponents = dateComponents[4].split(':');
	hours = parseInt(timeComponents[0], 10);
	minutes = parseInt(timeComponents[1], 10);
	seconds = parseInt(timeComponents[2], 10);
	return new Date(year, month, day, hours, minutes, seconds, 0);
}
 
/* Grab the last post on the wall to see if its less recent
 * than something in the cache. If it is, we can stop. Unless
 * the cache doesn't have the full history, in which case we
 * should try to grab it.
 */
function shouldStopFetching() {
	if (!localStorage.didGoBackAllTheWay) {
		return false;
	}
	var shouldStop = false;
	var storyContent = $(fullFeed).find('.storyContent');
	if (storyContent.length > 0) {
		var i = 0;
		for (i = storyContent.length - 1; i >= 0; i -= 1) {
			var value = storyContent[i];
			var dateAbbr = $(value).find('span.uiStreamFooter abbr');
			if (dateAbbr.length > 0) {
				date = $(dateAbbr[0]).attr('data-date');
				if (typeof date != 'undefined' && date != false) {
					var onWall = dateObjectFromFBRepresentation(date);
			
					// The latest thing in the cache will always
					// be the first entry.
					var latest = JSON.parse(localStorage.cache)[0];
					var inCache = dateObjectFromFBRepresentation(latest.date);
					if (inCache > onWall) {
						return true;
					} else {
						return false;
					}
				}
			}
		}
	}	
	return false;
}
 
function fetchAllProfilePosts() {
	/* Monitor the page for changes to the "Older Posts"
	 * link. When we see the id for that link has changed,
	 * fetch more content so the HTML parser can read the
	 * user's history.
	 */
	loading_in_process = true;
	var pager_id = "0";
	pager_interval = setInterval(function() { 
		if (shouldStopFetching()) {
			clearInterval(pager_interval);
			cacheFBWall(false);
		}
		var curr_pager_id = $($('#profile_pager').html()).attr("id");
		if (typeof curr_pager_id == 'undefined' || !curr_pager_id) {
			// We know we're actually done if the div's html contains
			// "no more posts to show"
			if ($('#profile_pager').html().indexOf("no more") != -1) {
				clearInterval(pager_interval);
				localStorage.didGoBackAllTheWay = true;
				cacheFBWall(true);
				alert("We've finished loading your Facebook wall. We've saved the data to local storage, so next time you want to search for something, the wait will be much shorter. Thanks for your patience!");
			}
		}
		else if (curr_pager_id != pager_id) { 
			pager_id = curr_pager_id;
			// We can now fetch more content.
			$('.uiMorePagerPrimary').trigger('click');
			updateCurrentFBWallContents();
		}
	}, 0); // Poll for changes continously.	
}
 
function userIsOnProfilePage() {
	var isOnProfilePage = false;
	var prof_actions = $('#profile_view_actions').html();
	if (typeof prof_actions != 'undefined' && prof_actions != null) {
		if (prof_actions.indexOf("Edit Profile") != -1) {
				isOnProfilePage = true;
		}
	}
	return isOnProfilePage;
}
 
function pollForOurProfile() {
	profile_view_interval = setInterval(function () {
		if (userIsOnProfilePage()) {
			// If we're on our own profile page, we need
			// to process the posts.
			clearInterval(profile_view_interval);
			fetchAllProfilePosts();
		}
	}, 1000); // Poll for changes every second.
}
 
$(document).ready(function(){
	loading_in_process = true;
	chrome.extension.onRequest.addListener(
	function(request, sender, sendResponse) {
  		if (request.action == "getFBPosts") {
  			/* For now, user can only search when they're
  			 * on their profile page. This is to ensure the
  			 * index is built when needed.
  			 */
  			if (!userIsOnProfilePage()) {
  				sendResponse({canSearch: false, fbPosts:[]});
  			}
  			if (!loading_in_process) {
  				sendResponse({canSearch: true, fbPosts: localStorage.cache});
  			}  
		}
	});
	
	/* I'm not sure why, but document ready is only getting
	 * called once during an entire session on FB's site. If I
	 * navigate from one profile to another, this script is not
	 * unloaded and re-loaded. To work around this, I'm adding a
	 * listener to the page title. When we see the page title has
	 * changed, we can bail out of our current parsing state, cache
	 * everything we've read, and go back to passive mode.
	 */
	var currURL = document.URL; 
	var page_title_interval = setInterval(function () {
		if (document.URL != currURL) {
			currURL = document.URL;
			/* Kill the caching process. If we come back to
			 * our profile, we'll start it up again.
			 */
			clearInterval(pager_interval);
			clearInterval(profile_view_interval);
			cacheFBWall(false);
			pollForOurProfile();
		}
	}, 1);
	pollForOurProfile();
});

$(window).unload(function() {
	clearInterval(pager_interval);
	clearInterval(profile_view_interval);
	cacheFBWall(false);
});