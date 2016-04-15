'use strict';

function removeChildren(element) {
    while (element.firstChild) element.removeChild(element.firstChild);
}

window.onload = function() {
    const textarea    = document.getElementsByTagName('textarea')[0];
    const grammarized = document.getElementById('grammarized');

    let oldText = '';
    let timeout = null;

    function handleChange() {
        const text = textarea.value;
        if (text === oldText) return;
        oldText = text;

        const rules = mutagenParse(text);
        const factory = Factory(rules['-gorey-fate-']);

        removeChildren(grammarized);
        for (let i = 0; i < 5; ++i) {
            grammarized.appendChild(document.createTextNode(factory(i)));
            grammarized.appendChild(document.createElement('br'));
        }
    }
    handleChange();

    function eventHandler() {
        if (timeout) clearTimeout(timeout);
        timeout = setTimeout(handleChange, 0);
    }
    textarea.onkeydown = textarea.onkeyup = textarea.onclick = eventHandler;

    textarea.focus();
}
