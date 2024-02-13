const CleanCSS = require("clean-css");
const Terser = require("terser");
const { DateTime } = require("luxon");
const syntaxHighlightPlugin = require("@11ty/eleventy-plugin-syntaxhighlight");
const markdownIt = require("markdown-it");
const markdownItFootnote = require("markdown-it-footnote");

module.exports = eleventyConfig => {
    eleventyConfig.addPlugin(syntaxHighlightPlugin);

    let markdownItOptions = {
        html: true,
        breaks: true,
        linkify: true
    };
    // markdown
    eleventyConfig.setLibrary("md",
      markdownIt(markdownItOptions)
      .use(markdownItFootnote)
    );

    // filters
    eleventyConfig.addFilter("cssmin", code => {
        return new CleanCSS({}).minify(code).styles;
    });

    eleventyConfig.addFilter("jsmin", code => {
        let minified = Terser.minify(code);
        if (minified.error) {
            console.log("Terser error: ", minified.error);
            return code;
        }
    });

    eleventyConfig.addFilter("readableDate", dateObj => {
        return DateTime.fromJSDate(dateObj, { zone: "utc" }).toFormat(
            "dd LLL yyyy"
        );
    });

    // https://html.spec.whatwg.org/multipage/common-microsyntaxes.html#valid-date-string
    eleventyConfig.addFilter("htmlDateString", dateObj => {
        return DateTime.fromJSDate(dateObj, { zone: "utc" }).toFormat(
            "yyyy-LL-dd"
        );
    });

    eleventyConfig.addFilter("toDateObj", dateString => {
        return new Date(dateString);
    });

    // shortcodes
    eleventyConfig.addShortcode("emoji", (emoji, alt = "") => {
        return (
            `<span aria-hidden="true" class="emoji">${emoji}</span>` +
            (alt ? `<span class="sr-only">${alt}</span>` : "")
        );
    });

    eleventyConfig.addShortcode("anchored-code", (code, link) => {
        return `<code><a href="${link}" target="_blank">${code}</a></code>`;
    });

    // handle draft posts
    const now = new Date();
    eleventyConfig.addCollection("posts", collection => {
        return collection
            .getFilteredByGlob("./blog/posts/*.md")
            .filter(post => post.date <= now && !post.data.draft);
    });

    // TODO add .bib as custom data format

    // passthrough copy
    eleventyConfig.addPassthroughCopy("assets");
    eleventyConfig.addPassthroughCopy("keybase.txt");
    eleventyConfig.addPassthroughCopy("decks/assets");
    eleventyConfig.addPassthroughCopy("decks/revealjs");
    eleventyConfig.addPassthroughCopy("decks/**/*");
};
