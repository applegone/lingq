// ==UserScript==
// @name         Delete Lesson's Known Words
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  Adds a button to delete all learned words from a lesson's stats page.
// @author       applegone, roosterburton
// @match        https://www.lingq.com/*/learn/*/web/reader/*
// ==/UserScript==


(function() {
    'use strict';


    // Function to create and show a notification
    function showToast(message) {
        const notification = document.createElement('div');
        notification.className = 'notification';
        notification.textContent = message;

        // Add styles to the notification
        notification.style.position = 'fixed';
        notification.style.top = '10px';
        notification.style.left = '50%';
        notification.style.transform = 'translateX(-50%)';
        notification.style.backgroundColor = 'red';
        notification.style.color = 'white';
        notification.style.zIndex = '1000';

        document.body.appendChild(notification);

        return notification;
    }

    //to prevent too many requests from LingQ
    // credit to Roosterburton
    function delay(time) {
        return new Promise(resolve => setTimeout(resolve, time));
    }

    // have to set the term as a card before we can "reset" it as a blue/new lingq
    // credit to Roosterburton for finding the API and basis of the code
    async function postCard(term, language, lessonId) {
        const jsonData = {
            "term": term,
            "status": 0,
        };

        return await fetch('https://www.lingq.com/api/v2/' + language + '/cards/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(jsonData)
        }).then(response => response.json())
          .catch(error => {
            throw new Error('Failed to update card: ' + term)
        });
    }

    // delete the card which effectively makes the lingq a new/blue term/lingq
    // credit to Roosterburton for finding the API and basis of the code
    async function deleteCard(term, cardId, language) {
        return await fetch(`https://www.lingq.com/api/v2/${language}/cards/${cardId}/`, {
            method: 'DELETE',
        }).catch (error => {
            throw new Error('Failed to delete card: ' + term);
        })
    }

    function addUndoButton() {
        // Create a new button element
        const undoBtn = document.createElement('button');
        undoBtn.className = 'button undo-learned-words';

        // Set the inner HTML with multi-line formatting
        undoBtn.innerHTML = `
            <span class="button-wrapper grid-layout grid-align--center grid-item is-fluid--left">
                <span class="text-wrapper has-text-dark">Undo Learned Words</span>
            </span>
        `;

        // Find the parent div with the class 'flex-layout'
        const lingqListSection = document.querySelector('.last-page-section:not(.last-page-section--next-lesson)');


        // Append the new button to the flex layout div
        lingqListSection.appendChild(undoBtn);

        // Add click listener to the delete button
        undoBtn.addEventListener('click', async function() {
           const progressMessage = (count) => `Removing ${count} words. Estimated time to completion is ${count * 2} seconds. Do NOT navigate away from this page.`;

            // Retrieve all the terms from lingq-list
            const termElements = document.querySelector('.lingq-list');
            const terms = Array.from(termElements.children).map(termElement => termElement.textContent.trim());

            // grab lesson info
            const url = window.location.pathname.split('/');
            const language = url[3] || null;
            const lessonId = url[6] || null;

            // grab the cards for this lesson
            const lessonsCards = await fetch("https://www.lingq.com/api/v3/" + language + "/lessons/" + lessonId + "/words").then(resp => resp.json()).then(json => new Map(Object.entries(json.cards).map(([key, value]) => [value.term, key])));

            let removed = 0;
            let failed = 0;

            const notification = showToast(progressMessage(terms.length));
            for (const term of terms) {
                try {
                    // assume terms marked as "known" in the summary section were never cards in the past
                    if (! lessonsCards.has(term)) {
                        const newCard = await postCard(term, language, lessonId);
                        await delay(1000);
                        await deleteCard(term, newCard.pk, language);
                        await delay(1000);
                        removed += 1;
                    }
                } catch (error) {
                    console.error('Error:', error);
                    failed += 1;
                }
                notification.textContent = progressMessage(terms.length - removed - failed);
            }
            notification.remove();
            const completionNotification = showToast('Removed ' + removed + ', failed to remove: ' + failed + ". You can navigate away from this page.");
            setTimeout(() => completionNotification.remove(), 10000);
        });

    }

    var observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            if (mutation.type === 'childList' && document.querySelector('.last-page-section') && !document.querySelector('.undo-learned-words')) {
                addUndoButton();
            }
        });
    });
    observer.observe(document.body, {childList: true, subtree: true });
})();
