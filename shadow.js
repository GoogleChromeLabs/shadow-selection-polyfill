/**
 * Copyright 2018 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not
 * use this file except in compliance with the License. You may obtain a copy of
 * the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
 * License for the specific language governing permissions and limitations under
 * the License.
 */

const debug = false;

const hasShadow = 'attachShadow' in Element.prototype && 'getRootNode' in Element.prototype;
const hasSelection = !!(hasShadow && document.createElement('div').attachShadow({ mode: 'open' }).getSelection);
const hasShady = window.ShadyDOM && window.ShadyDOM.inUse;
const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent) ||
  /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
const useDocument = !hasShadow || hasShady || (!hasSelection && !isSafari);

const validNodeTypes = [Node.ELEMENT_NODE, Node.TEXT_NODE, Node.DOCUMENT_FRAGMENT_NODE];
function isValidNode(node) {
  return validNodeTypes.includes(node.nodeType);
}

function findNode(s, parentNode, isLeft) {
  const nodes = parentNode.childNodes || parentNode.children;
  if (!nodes) {
    return parentNode;  // found it, probably text
  }

  for (let i = 0; i < nodes.length; ++i) {
    const j = isLeft ? i : (nodes.length - 1 - i);
    const childNode = nodes[j];
    if (!isValidNode(childNode)) {
      continue;
    }

    debug && console.debug('checking child', childNode, 'IsLeft', isLeft);
    if (s.containsNode(childNode, true)) {
      if (s.containsNode(childNode, false)) {
        debug && console.info('found child', childNode);
        return childNode;
      }
      debug && console.info('descending child', childNode);
      return findNode(s, childNode, isLeft);
    }
    debug && console.info(parentNode, 'does NOT contain', childNode);
  }
  return parentNode;
}

/**
 * @param {function(!Event)} fn to add to selectionchange internals
 */
const addInternalListener = (() => {
  if (hasSelection || useDocument) {
    // getSelection exists or document API can be used
    document.addEventListener('selectionchange', (ev) => {
      document.dispatchEvent(new CustomEvent('-shadow-selectionchange'));
    });
    return () => {};
  }

  let withinInternals = false;
  const handlers = [];

  document.addEventListener('selectionchange', (ev) => {
    if (withinInternals) {
      return;
    }

    withinInternals = true;

    document.dispatchEvent(new CustomEvent('-shadow-selectionchange'));
    window.requestAnimationFrame(() => {
      withinInternals = false;
    });

    handlers.forEach((fn) => fn(ev));
  });

  return (fn) => handlers.push(fn);
})();

addInternalListener((ev) => {
  const s = window.getSelection();
  if (s.type === 'Caret') {
    // nb. This is important, it mucks with single-positioned selections enough to make ranges work
    s.collapseToEnd();
    s.collapseToStart();
    s.empty();
    s.deleteFromDocument();
  }
});


/**
 * @param {!Selection} s the window selection to use
 * @param {!Node} node the node to walk from
 * @param {boolean} walkForward should this walk in natural direction
 * @return {boolean} whether the selection contains the following node (even partially)
 */
function containsNextElement(s, node, walkForward) {
  const start = node;
  while (node = walkFromNode(node, walkForward)) {
    // walking (left) can contain our own parent, which we don't want
    if (!node.contains(start)) {
      break;
    }
  }
  if (!node) {
    return false;
  }
  // we look for Element as .containsNode says true for _every_ text node, and we only care about
  // elements themselves
  return node instanceof Element && s.containsNode(node, true);
}


/**
 * @param {!Selection} s the window selection to use
 * @param {!Node} leftNode the left node
 * @param {!Node} rightNode the right node
 * @return {boolean|undefined} whether this has natural direction
 */
function getSelectionDirection(s, leftNode, rightNode) {
  if (s.type !== 'Range') {
    return undefined;  // no direction
  }
  const measure = () => s.toString().length;

  const initialSize = measure();
  debug && console.info(`initial selection: "${s.toString()}"`)

  let updatedSize;

  // Try extending forward and seeing what happens.
  s.modify('extend', 'forward', 'character');
  updatedSize = measure();
  debug && console.info(`forward selection: "${s.toString()}"`)

  if (updatedSize > initialSize || containsNextElement(s, rightNode, true)) {
    debug && console.info('got forward >, moving right')
    s.modify('extend', 'backward', 'character');
    return true;
  } else if (updatedSize < initialSize || !s.containsNode(leftNode)) {
    debug && console.info('got forward <, moving left')
    s.modify('extend', 'backward', 'character');
    return false;
  }

  // Maybe we were at the end of something. Extend backwards.
  // TODO(samthor): We seem to be able to get away without the 'backwards' case.
  s.modify('extend', 'backward', 'character');
  updatedSize = measure();
  debug && console.info(`backward selection: "${s.toString()}"`)

  if (updatedSize > initialSize || containsNextElement(s, leftNode, false)) {
    debug && console.info('got backwards >, moving left')
    s.modify('extend', 'forward', 'character');
    return false;
  } else if (updatedSize < initialSize || !s.containsNode(rightNode)) {
    debug && console.info('got backwards <, moving right')
    s.modify('extend', 'forward', 'character');
    return true;
  }

  // This is likely a select-all.
  return undefined;
}

/**
 * Returns the next valid node (element or text). This is needed as Safari doesn't support
 * TreeWalker inside Shadow DOM. Don't escape shadow roots.
 *
 * @param {!Node} node to start from
 * @param {boolean} walkForward should this walk in natural direction
 * @return {Node} node found, if any
 */
function walkFromNode(node, walkForward) {
  if (!walkForward) {
    return node.previousSibling || node.parentNode || null;
  }
  while (node) {
    if (node.nextSibling) {
      return node.nextSibling;
    }
    node = node.parentNode;
  }
  return null;
}


const cachedRange = new Map();
export function getRange(root) {
  if (hasSelection || useDocument) {
    const s = (useDocument ? document : root).getSelection();
    return s.rangeCount ? s.getRangeAt(0) : null;
  }

  const thisFrame = cachedRange.get(root);
  if (thisFrame) {
    return thisFrame;
  }

  const result = internalGetShadowSelection(root);

  cachedRange.set(root, result.range);
  window.setTimeout(() => {
    cachedRange.delete(root);
  }, 0);
  debug && console.debug('getRange got', result);
  return result.range;
}


export function internalGetShadowSelection(root) {
  // nb. We used to check whether the selection contained the host, but this broke in Safari 13.
  // This is "nicely formatted" whitespace as per the browser's renderer. This is fine, and we only
  // provide selection information at this granularity.
  const s = window.getSelection();

  if (s.type === 'None') {
    return {range: null, type: 'none'};
  } else if (!(s.type === 'Caret' || s.type === 'Range')) {
    throw new TypeError('unexpected type: ' + s.type);
  }

  const leftNode = findNode(s, root, true);
  if (leftNode === root) {
    return {range: null, mode: 'none'};
  }

  const range = document.createRange();

  let rightNode = null;
  let isNaturalDirection = undefined;
  if (s.type === 'Range') {
    rightNode = findNode(s, root, false);  // get right node here _before_ getSelectionDirection
    isNaturalDirection = getSelectionDirection(s, leftNode, rightNode);
    // isNaturalDirection means "going right"

    if (isNaturalDirection === undefined) {
      // This occurs when we can't move because we can't extend left or right to measure the
      // direction we're moving in. Good news though: we don't need to _change_ the selection
      // to measure it, so just return immediately.
      range.setStart(leftNode, 0);
      range.setEnd(rightNode, rightNode.length);
      return {range, mode: 'all'};
    }
  }


  // Dumbest possible approach: remove characters from left side until no more selection,
  // re-add.

  // Try right side first, as we can trim characters until selection gets shorter.

  let leftOffset = 0;
  let rightOffset = 0;

  if (rightNode === null) {
    // This is a caret selection, do nothing.
  } else if (rightNode.nodeType === Node.TEXT_NODE) {
    const rightText = rightNode.textContent;
    const initialSize = s.toString().length;
    const existingNextSibling = rightNode.nextSibling;

    for (let i = rightText.length - 1; i >= 0; --i) {
      rightNode.splitText(i);
      const updatedSize = s.toString().length;
      if (updatedSize !== initialSize) {
        rightOffset = i + 1;
        break;
      }
    }

    // We don't use .normalize() here, as the user might already have a weird node arrangement
    // they need to maintain.
    rightNode.insertData(rightNode.length, rightText.substr(rightNode.length));
    while (rightNode.nextSibling !== existingNextSibling) {
      rightNode.nextSibling.remove();
    }
  }

  if (leftNode.nodeType === Node.TEXT_NODE) {
    if (leftNode !== rightNode) {
      s.collapseToStart();
      s.modify('extend', 'forward', 'character');
    }

    const leftText = leftNode.textContent;
    const existingNextSibling = leftNode.nextSibling;

    const start = (leftNode === rightNode ? rightOffset : leftText.length - 1);

    for (let i = start; i >= 0; --i) {
      leftNode.splitText(i);
      if (s.toString() === '') {
        leftOffset = i;
        break;
      }
    }

    // As above, we don't want to use .normalize().
    leftNode.insertData(leftNode.length, leftText.substr(leftNode.length));
    while (leftNode.nextSibling !== existingNextSibling) {
      leftNode.nextSibling.remove();
    }

    if (rightNode === null) {
      rightNode = leftNode;
      rightOffset = leftOffset;
    }
  }

  if (leftNode === rightNode) {
    console.info('got range', leftNode.textContent.substring(leftOffset, rightOffset), 'nat?', isNaturalDirection);
  } else {
    console.warn('wide range');
  }

  if (isNaturalDirection === true) {
    s.collapse(leftNode, leftOffset);
    s.extend(rightNode, rightOffset);
  } else if (isNaturalDirection === false) {
    s.collapse(rightNode, rightOffset);
    s.extend(leftNode, leftOffset);
  } else {
    if (leftNode !== rightNode) {
      console.warn('cannot do anything with selection', leftOffset, rightOffset);
    } else {
      s.setPosition(leftNode, leftOffset);
    }
  }

  range.setStart(leftNode, leftOffset);
  range.setEnd(rightNode, rightOffset);
  return {range, mode: 'normal'};
}
