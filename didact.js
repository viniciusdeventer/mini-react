// Transforms JSX into a plain object representing a UI element.
// Babel calls this function when it compiles JSX like <div id="app" />.
// `type` is the tag name ("div", "h1", etc.) or a component function.
// `props` holds attributes like { id: "app", className: "box" }.
// `...children` collects every nested element as a rest parameter array.
function createElement(type, props, ...children) {
  return {
    type,
    props: {
      ...props, // spread original props (e.g. id, className, event handlers)

      // Normalize children: if a child is already an element object, keep it;
      // if it's a primitive (string, number), wrap it in a TEXT_ELEMENT node.
      // This keeps the render function uniform — it always deals with objects.
      children: children.map(child =>
        typeof child === "object"
          ? child
          : createTextElement(child)
      ),
    },
  }
}

// Creates a virtual node for raw text content (strings and numbers).
// Real React just uses the primitive directly, but Didact wraps it in an object so that render() can handle every node the same way, without special-casing "is this a string or an element?".
// `nodeValue` is the actual DOM property that holds the text content assigning it to a text node is equivalent to node.nodeValue = "Hello".
function createTextElement(text) {
  return {
    type: "TEXT_ELEMENT", // sentinel type; render() checks for this string
    props: {
      nodeValue: text,    // will be assigned directly to the DOM text node
      children: [],       // text nodes never have children
    },
  }
}

function render(element, container) {
  // 1. If element.type is "TEXT_ELEMENT", create a text node with document.createTextNode(""); 
  // Otherwise use document.createElement(element.type).
  const dom =
    element.type === "TEXT_ELEMENT"
      ? document.createTextNode("")
      : document.createElement(element.type)

  // 2. Assign all props (except "children") directly to the DOM node.
  Object.keys(element.props)
    .filter(key => key !== "children")
    .forEach(name => {
      dom[name] = element.props[name]
    })

  // 3. Recursively call render for each child, passing the newly created node as the container.
  element.props.children.forEach(child => render(child, dom))

  // 4. Append the node to the container.
  container.appendChild(dom)
}

// Testes da Missão 1: Basic Rendering

// const Didact = { createElement, render }

// // We are not using JSX yet, so we write the nested calls manually
// const element = Didact.createElement(
//   "div",
//   { style: "background: salmon; padding: 20px; border-radius: 8px;" },
//   Didact.createElement("h1", null, "Mission 1: Success! 🎉"),
//   Didact.createElement("p", null, "If you can see this, your DOM creation is working.")
// )

// const container = document.getElementById("root")
// Didact.render(element, container)

let nextUnitOfWork = null

function workLoop(deadline) {
  let shouldYield = false
  while (nextUnitOfWork && !shouldYield) {
    nextUnitOfWork = performUnitOfWork(nextUnitOfWork)
    shouldYield = deadline.timeRemaining() < 1
  }

  if (!nextUnitOfWork && wipRoot) {
    commitRoot()
  }

  requestIdleCallback(workLoop)
}

requestIdleCallback(workLoop)

function createDom(fiber) {
  const dom =
    fiber.type === "TEXT_ELEMENT"
      ? document.createTextNode("")
      : document.createElement(fiber.type)

  updateDom(dom, {}, fiber.props)
  return dom
}

function performUnitOfWork(fiber) {
  const isFunctionComponent = fiber.type instanceof Function
  if (isFunctionComponent) {
    updateFunctionComponent(fiber)
  } else {
    updateHostComponent(fiber)
  }
 
  // 1. Child first — depth-first descent
  if (fiber.child) {
    return fiber.child
  }
 
  // 2. No child: look for a sibling, or climb until we find an uncle
  let next = fiber
  while (next) {
    if (next.sibling) {
      return next.sibling   // found a sibling (or uncle at some level)
    }
    next = next.parent      // climb one level and try again
  }
 
  // 3. next became undefined — we walked all the way back past the root
  return undefined
}
 
// Handles plain HTML elements (div, h1, p, …)
function updateHostComponent(fiber) {
  if (!fiber.dom) {
    fiber.dom = createDom(fiber)
  }
  reconcileChildren(fiber, fiber.props.children)
}

// Testes da Missão 2: Fiber Traversal Logic

/* Let's simulate this tree:
      A
     / \
    B   D
   /
  C
*/

// 1. Create fake fibers
const fiberC = { type: "C", props: {} };
const fiberB = { type: "B", props: {}, child: fiberC };
const fiberD = { type: "D", props: {} };
const fiberA = { type: "A", props: {}, child: fiberB };

// 2. Link parents and siblings
fiberC.parent = fiberB;
fiberB.parent = fiberA;
fiberD.parent = fiberA;
fiberB.sibling = fiberD;

// 3. Temporarily mock the update function so it doesn't try to touch the DOM
const originalUpdateHost = updateHostComponent;
updateHostComponent = (fiber) => { 
  console.log("Visiting node:", fiber.type); 
};

// 4. Run your Work Loop logic manually
console.log("--- Starting Fiber Traversal Test ---");
let nextUnit = fiberA;
while (nextUnit) {
  nextUnit = performUnitOfWork(nextUnit);
}
console.log("--- Traversal Finished ---");

// Restore the original function for the next missions
updateHostComponent = originalUpdateHost;