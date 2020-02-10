Polyfill for the `shadowRoot.getSelection()` method for Safari 10+.
[See a demo](https://googlechromelabs.github.io/shadow-selection-polyfill/demo.html)!

Safari supports `.attachShadow()` to create a Shadow Root, but does not support retrieving user selection within this root.
You can safely use this code with other browsers (Firefox and Chromium), where it'll use the native version.

⚠️ This has been rewritten in February 2020 to fix a number of issues with the older version.

## Usage

Include `./shadow.js` as an ES6 module, and call its `getRange` method, passing the shadow root you would like to check.
This uses a native implementation where available (on Firefox and Chromium).

Typically, you'd call this method in response to a `selectionchange` event, which is a global event on the document.
However, this polyfill will cause additional `selectionchange` events to fire in the course of its work—possibly hundreds.
Instead, you can listen to the `-shadow-selectionchange` event (exposed as `shadow.eventName`), which will safely fire only once.

```js
import * as shadow from './node_modules/shadow-selection-polyfill/shadow.js';

const root = myElement.createShadowRoot({mode: 'open'});
root.innerHTML = `...`;

document.addEventListener(shadow.eventName, () => {
  const range = shadow.getRange(root);
  if (range) {
    console.info('range selected within root element', range.toString());
  }
});
```

Don't use this with `.attachShadow({mode: 'closed'})`, which is generally considered an antipattern anyway.

## Install

Install via NPM as `shadow-selection-polyfill`, this has no dependencies.
Depending on your transpiler, you might be able to include the polyfill with:

```js
// naked imports
import * as shadow from `shadow-selection-polyfill`;
// require() compatibility
const shadow = require('shadow-selection-polyfill');
```

## Implementation

This polyfill basically rapidly splits `Text` nodes until it can find out just how many characters from the 'edge' of a Shadow Root that a user has selected.
It uses this combined with a few other tricks to come up with a range.

The algorithm is O(n) with respect to:

* the maximum length of a text node that contains the start or end of a selection range
* the depth of your nodes

If speed is important to you, then keep individual text nodes small.

## Notes

### Native Versions

As of February 2020, Firefox does not implement `getSelection()` on the Shadow Root ([issue](https://bugzilla.mozilla.org/show_bug.cgi?id=1430308)), but happily pierces the Shadow Root from the document globally.
Chromium also implements `ShadowRoot.getSelection()` in an unofficial way.
You can use this library to work around differences in browser implementations, as it'll use the native version when available.

### Other

This isn't technically a polyfill, as it adds completely new functionality: it doesn't patch an existing method.
There's nothing stopping us from emulating a faux-Selection, but it would probably make the code more complex than required.

This is not an official Google product.
