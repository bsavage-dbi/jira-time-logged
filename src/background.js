var reloadLoggedWorkEvents;
(function() {
    chrome.alarms.create("refresh", {"periodInMinutes": 5, "delayInMinutes": 5});
    chrome.alarms.onAlarm.addListener(refreshData);

    function updateTotalActionBadge(loggedWorkEvents) {
        var total = loggedWorkEvents.reduce(function(curr, prev) {
            return {loggedWork: curr.loggedWork + prev.loggedWork};
        }, {loggedWork: 0}).loggedWork;
        var totalStr = Math.floor(total / 60) + ":" + pad(total % 60, 2);
        chrome.browserAction.setBadgeText({"text": totalStr});
    }

    function storeEventsInStorage(loggedWorkEvents) {
        chrome.storage.local.set({
            'loggedWorkEvents': loggedWorkEvents
        });
    }

    function refreshData() {
        var loggedWorkEvents = getLoggedWorkEvents();
        loggedWorkEvents.done(updateTotalActionBadge);
        loggedWorkEvents.done(storeEventsInStorage);
    }
    reloadLoggedWorkEvents = refreshData;

    function getLoggedWorkEvents() {
        var deferred = new $.Deferred();
        var startDate = new Date();
        startDate.setHours(0, 0, 0, 0);
        var endDate = new Date();
        endDate.setDate(startDate.getDate() + 1);
        endDate.setHours(0, 0, 0, 0);
        chrome.storage.local.get(function(data) {
            if (data.username && data.server && data.key) {
                $.get(data.server + "/activity?maxResults=99&streams=key+IS+" + data.key + "&streams=update-date+BETWEEN+" + startDate.getTime() + "+" + endDate.getTime() + "&streams=user+IS+" + data.username + "&issues=activity+IS+issue%3Aupdate&providers=issues&os_authType=basic",
                        function(data) {
                            var $xml = $(data);
                            var logEntries = [];
                            $xml.find("entry").each(function() {
                                var $this = $(this);
                                var matchesMultipleChanges = $this.find("content[type=html]").text().match(/.*<li>Logged '(.*)'<\/li>.*/);
                                var matchesSingleChange = $this.find("title[type=html]").text().match(/.*logged '(.*)' on.*/);
                                var matches = matchesMultipleChanges ? matchesMultipleChanges : matchesSingleChange;
                                if (matches) {
                                    logEntries.push(
                                            {
                                                "key": $this.find("title[type=text]").text(),
                                                "summary": $this.find("summary[type=text]").text(),
                                                "link": $this.find("link[rel=alternate]").attr("href"),
                                                "loggedWork": loggedTimeInMinutes(matches[1]),
                                                "date": new Date($this.find("published").text()).getTime()
                                            }
                                    );

                                }
                            });
                            deferred.resolve(logEntries);
                        }
                );
            }
        });
        return deferred;
    }



    function loggedTimeInMinutes(loggedWork) {
        var e = loggedWork.replace(/h/g, "*60");
        e = e.replace(/m/g, "");
        e = e.replace(/d/g, "*60*8");
        e = e.replace(/ /g, "+");
        return eval(e);
    }

    function pad(str, max) {
        return (str + "").length < max ? pad("0" + str, max) : str;
    }
})();
