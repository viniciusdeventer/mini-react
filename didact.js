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
