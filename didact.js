// ── 1.1 createElement (provided) ─────────────────────────────

function createElement(type, props, ...children) {
  return {
    type,
    props: {
      ...props,
      children: children.map(child =>
        typeof child === "object"
          ? child
          : createTextElement(child)
      ),
    },
  }
}

function createTextElement(text) {
  return {
    type: "TEXT_ELEMENT",
    props: {
      nodeValue: text,
      children: [],
    },
  }
}

// ── 2.1 Work Loop (provided) ──────────────────────────────────

let nextUnitOfWork = null
let wipRoot       = null
let currentRoot   = null
let deletions     = null
let wipFiber      = null
let hookIndex     = null

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

// ── 2.2 createDom (provided) ──────────────────────────────────

function createDom(fiber) {
  const dom =
    fiber.type === "TEXT_ELEMENT"
      ? document.createTextNode("")
      : document.createElement(fiber.type)

  updateDom(dom, {}, fiber.props)
  return dom
}

// ── 2.3 performUnitOfWork (Mission 2) ────────────────────────

function performUnitOfWork(fiber) {
  const isFunctionComponent = fiber.type instanceof Function
  if (isFunctionComponent) {
    updateFunctionComponent(fiber)
  } else {
    updateHostComponent(fiber)
  }

  if (fiber.child) return fiber.child

  let next = fiber
  while (next) {
    if (next.sibling) return next.sibling
    next = next.parent
  }

  return undefined
}

function updateHostComponent(fiber) {
  if (!fiber.dom) {
    fiber.dom = createDom(fiber)
  }
  reconcileChildren(fiber, fiber.props.children)
}

function updateFunctionComponent(fiber) {
  wipFiber = fiber
  hookIndex = 0
  wipFiber.hooks = []
 
  // Calling fiber.type(fiber.props) executes the component function.
  // Any useState inside it will read wipFiber and hookIndex above.
  const children = [fiber.type(fiber.props)]
  reconcileChildren(fiber, children)
}

// ── 3.1 Commit Phase (provided — with your comments) ─────────

// Updated render: instead of touching the DOM right away, we create
// a work-in-progress root fiber and let the work loop do the job.
// `alternate` points to the current tree so the reconciler can diff them.
function render(element, container) {
  wipRoot = {
    dom: container,                  // the real DOM node we'll render into
    props: { children: [element] },  // wrap the element so it looks like any other fiber
    alternate: currentRoot,          // link to the committed tree for diffing
  }
  deletions = []           // reset the list of nodes to remove
  nextUnitOfWork = wipRoot // kick off the work loop from the root
}

// Called once all fibers are processed (nextUnitOfWork === null).
// This is the only moment we actually touch the DOM — keeping it atomic.
function commitRoot() {
  // First, remove nodes that were marked for deletion during reconciliation.
  deletions.forEach(commitWork)

  // Then, walk the new tree starting from the first child of the root fiber
  // and apply PLACEMENT / UPDATE operations.
  commitWork(wipRoot.child)

  // The work-in-progress tree is now the current tree.
  currentRoot = wipRoot
  wipRoot = null
}

// Recursively applies one fiber's effectTag to the real DOM, then
// recurses into children and siblings.
function commitWork(fiber) {
  if (!fiber) return

  // Function components don't have a DOM node themselves —
  // climb up until we find an ancestor that does.
  let domParentFiber = fiber.parent
  while (!domParentFiber.dom) {
    domParentFiber = domParentFiber.parent
  }
  const domParent = domParentFiber.dom

  if (fiber.effectTag === "PLACEMENT" && fiber.dom != null) {
    // New node: just append it to the parent.
    domParent.appendChild(fiber.dom)
  } else if (fiber.effectTag === "UPDATE" && fiber.dom != null) {
    // Existing node with new props: patch only what changed.
    updateDom(fiber.dom, fiber.alternate.props, fiber.props)
  } else if (fiber.effectTag === "DELETION") {
    // Node was removed: clean it from the DOM.
    commitDeletion(fiber, domParent)
  }

  // Depth-first: children before siblings, mirroring the build order.
  commitWork(fiber.child)
  commitWork(fiber.sibling)
}

// Removes a fiber's DOM node. If the fiber itself has no DOM node
// (function component), we descend until we find one.
function commitDeletion(fiber, domParent) {
  if (fiber.dom) {
    domParent.removeChild(fiber.dom)
  } else {
    commitDeletion(fiber.child, domParent)
  }
}

// ── 3.2 updateDom (your implementation) ──────────────────────
//
// Predicates that classify prop keys:
const isEvent    = key => key.startsWith("on")
const isProperty = key => key !== "children" && !isEvent(key)
const isNew      = (prev, next) => key => prev[key] !== next[key]
const isGone     = (prev, next) => key => !(key in next)

function updateDom(dom, prevProps, nextProps) {
  // ── Case 1: Remove event listeners that changed or disappeared ──
  // We must detach stale handlers BEFORE adding new ones to avoid
  // firing both the old and new callback on the same event.
  Object.keys(prevProps)
    .filter(isEvent)
    .filter(key => isGone(prevProps, nextProps)(key) || isNew(prevProps, nextProps)(key))
    .forEach(name => {
      const eventType = name.toLowerCase().substring(2) // "onClick" → "click"
      dom.removeEventListener(eventType, prevProps[name])
    })

  // ── Case 2: Remove regular props that no longer exist ──────────
  // Setting a DOM property to "" clears it without leaving stale state.
  Object.keys(prevProps)
    .filter(isProperty)
    .filter(isGone(prevProps, nextProps))
    .forEach(name => {
      dom[name] = ""
    })

  // ── Case 3: Set regular props that are new or changed ──────────
  // Assign directly on the DOM node (works for style, className, etc.).
  Object.keys(nextProps)
    .filter(isProperty)
    .filter(isNew(prevProps, nextProps))
    .forEach(name => {
      dom[name] = nextProps[name]
    })

  // ── Case 4: Add event listeners that are new or changed ────────
  // We only add what's actually different — the stale ones were
  // already removed in Case 1.
  Object.keys(nextProps)
    .filter(isEvent)
    .filter(isNew(prevProps, nextProps))
    .forEach(name => {
      const eventType = name.toLowerCase().substring(2)
      dom.addEventListener(eventType, nextProps[name])
    })
}

// ── 3.3 reconcileChildren (your implementation) ──────────────
//
// Diffs the new elements against the existing fiber tree to decide
// the minimum set of DOM operations needed.

function reconcileChildren(wipFiber, elements) {
  let index      = 0
  let oldFiber   = wipFiber.alternate && wipFiber.alternate.child
  let prevSibling = null

  while (index < elements.length || oldFiber != null) {
    const element = elements[index]
    let newFiber  = null

    const sameType = oldFiber && element && element.type === oldFiber.type

    // ── Case 1: Same type → UPDATE ──────────────────────────────
    // The element type didn't change (e.g. div → div), so we can
    // reuse the existing DOM node. We only need to patch the props.
    if (sameType) {
      newFiber = {
        type:      oldFiber.type,
        props:     element.props,   // new props to apply
        dom:       oldFiber.dom,    // reuse the existing DOM node ← the key performance win
        parent:    wipFiber,
        alternate: oldFiber,        // keep the link so commitWork can diff props
        effectTag: "UPDATE",
      }
    }

    // ── Case 2: New element, different (or no) old type → PLACEMENT
    // We can't reuse anything — a fresh DOM node must be created.
    // dom: null signals createDom() to build it later in updateHostComponent.
    if (element && !sameType) {
      newFiber = {
        type:      element.type,
        props:     element.props,
        dom:       null,            // will be created in updateHostComponent
        parent:    wipFiber,
        alternate: null,            // nothing to diff against
        effectTag: "PLACEMENT",
      }
    }

    // ── Case 3: Old fiber exists, different type → DELETION ─────
    // The old node is obsolete. Mark it and queue it for removal.
    // We don't create a new fiber here — Case 2 handles the new element.
    if (oldFiber && !sameType) {
      oldFiber.effectTag = "DELETION"
      deletions.push(oldFiber)
    }

    // Advance oldFiber to the next sibling for the next iteration.
    if (oldFiber) {
      oldFiber = oldFiber.sibling
    }

    // Wire the new fiber into the tree:
    // the first child hangs off wipFiber.child; subsequent ones link as siblings.
    if (index === 0) {
      wipFiber.child = newFiber
    } else if (element) {
      prevSibling.sibling = newFiber
    }

    prevSibling = newFiber
    index++
  }
}

function useState(initial) {
  // Step 1: Retrieve the old hook at this same position from the previous render.
  // This is how state survives between renders — it lives in the fiber, not the function.
  const oldHook =
    wipFiber.alternate &&
    wipFiber.alternate.hooks &&
    wipFiber.alternate.hooks[hookIndex]
 
  // Step 2: Create the new hook.
  // State starts from the old hook's value, or falls back to `initial` on first render.
  // The queue starts empty — it will be filled by setState calls made since last render.
  const hook = {
    state: oldHook ? oldHook.state : initial,
    queue: [],
  }
 
  // Step 3: Process the queue (batching).
  // Apply every queued action to compute the final state for this render.
  // An action can be a plain value OR a function (e.g. c => c + 1).
  const actions = oldHook ? oldHook.queue : []
  actions.forEach(action => {
    hook.state = typeof action === "function"
      ? action(hook.state)   // functional update: receives previous state
      : action               // direct value update
  })
 
  // Step 4: The setState dispatcher.
  // Pushing to hook.queue schedules the action for the NEXT render.
  // Resetting wipRoot wakes up the work loop to start a new render cycle.
  const setState = action => {
    hook.queue.push(action)
    wipRoot = {
      dom:       currentRoot.dom,
      props:     currentRoot.props,
      alternate: currentRoot,   // diff against the tree that's currently in the DOM
    }
    deletions        = []
    nextUnitOfWork   = wipRoot  // wake up the work loop
  }
 
  // Step 5: Advance the cursor and register the hook in this fiber's array.
  wipFiber.hooks.push(hook)
  hookIndex++
 
  return [hook.state, setState]
}

const Didact = { createElement, render }

// Testes da Missão 4

const container = document.getElementById("root")
 
function Greeting(props) {
  return Didact.createElement(
    "h1",
    { style: "color: green;" },
    "Mission 4: Hello, ",
    props.name,
    "!"
  )
}
 
const App = Didact.createElement(Greeting, { name: "Function Components" })
Didact.render(App, container)