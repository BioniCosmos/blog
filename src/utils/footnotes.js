'use strict';

hexo.extend.filter.register('before_post_render', data => {
    data.content = parseFootnotes(data.content);
    return data;
});

function parseFootnotes(text) {
    const md = require('markdown-it')();

    const filterFootnoteItems = /\[\^(\d+)\]: ?([\S\s]+?)(?=\[\^(?:\d+)\]|\n\n|$)/g;
    const filterFootnoteRefs = /\[\^(\d+)\]/g;

    var footnoteItems = [];

    // Remove every footnote items from the text and add each of them into an array.
    text = text.replace(filterFootnoteItems, (_item, _index, contents) => {
        footnoteItems.push(contents);
        return '';
    });

    if (footnoteItems.length === 0) {
        return text;
    }

    // Count the number of each index.
    let footnoteRefs = [...text.matchAll(filterFootnoteRefs)];
    var indexCounter = new Array(footnoteItems.length).fill(0);
    footnoteRefs.forEach(ref => {
        indexCounter[ref[1] - 1]++;
    });

    // Generate all footnote references.
    let countedIndex = new Array(footnoteItems.length).fill(0);
    text = text.replace(filterFootnoteRefs, (_ref, index) => {
        if (indexCounter[index - 1] === 1) {
            return `<sup class="footnote-ref"><a href="#fn${index}" id="fnref${index}">[${index}]</a></sup>`;
        } else {
            let refId = countedIndex[index - 1];
            countedIndex[index - 1]++;
            return `<sup class="footnote-ref"><a href="#fn${index}" id="fnref${index}-${refId}">[${index}]</a></sup>`;
        }
    });

    // Generate the footnote list.
    text += '<hr class="footnotes-sep"><section class="footnotes"><ol class="footnotes-list">';
    footnoteItems.forEach((contents, index) => {
        let realIndex = index + 1;
        if (indexCounter[index] === 1) {
            text += `<li id="fn${realIndex}" class="footnote-item"><a href="#fnref${realIndex}"><b>^</b></a> `
                + md.renderInline(contents)
                + '</li>';
        } else {
            text += `<li id="fn${realIndex}" class="footnote-item">^ `;
            for (let i = 0; i < indexCounter[index]; i++) {
                text += `<a href="#fnref${realIndex}-${i}"><sup><b>${realIndex}.${i}</b></sup></a> `;
            }
            text += md.renderInline(contents) + '</li>';
        }
    });
    text += '</ol></section>';

    return text;
}