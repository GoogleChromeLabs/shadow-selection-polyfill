Polyfill for the `shadowRoot.getSelection()` method for Safari 10+.
[See a demo](https://googlechromelabs.github.io/shadow-selection-polyfill/demo.html)!

Safari supports `.attachShadow()` to create a Shadow Root, but does not support programatically retrieving user selection within this root.

⚠️ As of April 2018, this polyfill only supports Safari, but is safe to include in other browsers supporting Shadow DOM (e.g. Chrome).

## Usage

Include `./shadow.js` as an ES6 module, and call its `getShadowRootSelectionRange` method, passing the relevant shadow root.
On browsers that implement `shadowRoot.getSelection()`, this uses the native implementation.

Typically, you'd call this method in response to a `selectionchange` event, which is a global event on the document.
However, this polyfill will cause additional `selectionchange` events to fire in the course of its work.
Instead, you can listen to the `-shadow-selectionchange` event, which will safely fire only once.

```js
import {getShadowRootSelectionRange} from './node_modules/shadow-selection-polyfill/shadow.js';

const root = myElement.createShadowRoot({mode: 'open'});
root.innerHTML = `...`;

document.addEventListener('-shadow-selectionchange', () => {
  const range = getShadowRootSelectionRange(root);
  if (range) {
    console.info('range selected within root element', range.toString());
  }
});
```

## Install

Install via NPM as `shadow-selection-polyfill`, this has no dependencies.
Depending on your transpiler, you might be able to include the polyfill with:

```js
// naked imports
import {getShadowRootSelectionRange} from `shadow-selection-polyfill`;
// require() compatibility
const {getShadowRootSelectionRange} = require('shadow-selection-polyfill');
```

## Other

This isn't technically a polyfill, as it adds a new method: it doesn't patch an existing method.
There's nothing stopping us from emulating a faux-Selection, but it would probably make the code more complex than required.

This is not an official Google product.
