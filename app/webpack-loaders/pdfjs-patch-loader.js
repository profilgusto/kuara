/**
 * Webpack loader that patches pdfjs-dist/build/pdf.mjs before bundling.
 *
 * Problem: pdf.mjs is itself a webpack bundle. It declares its own webpack
 * runtime variables (__webpack_exports__, __webpack_require__). When Next.js's
 * webpack processes this ESM file it recognises "__webpack_exports__" as its
 * own reserved exports identifier and replaces/freezes it. The inner webpack
 * runtime then calls Object.defineProperty on that frozen object → TypeError.
 *
 * Fix: rename the internal variables to something neutral before webpack sees
 * the file, so there is no naming collision.
 */
module.exports = function pdfjsPatchLoader(source) {
    return source
        .replace(/__webpack_exports__/g, '__pdfjs_exports__')
        .replace(/__webpack_require__/g, '__pdfjs_require__')
}
