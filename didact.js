// ── 1.1 createElement ────────────────────────────────────────

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

// ── 2.1 Global state ──────────────────────────────────────────

let nextUnitOfWork = null
let wipRoot        = null
let currentRoot    = null
let deletions      = null
let wipFiber       = null
let hookIndex      = null

// ── 2.1 Work Loop ─────────────────────────────────────────────

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

// ── 2.2 createDom ─────────────────────────────────────────────

function createDom(fiber) {
  const dom =
    fiber.type === "TEXT_ELEMENT"
      ? document.createTextNode("")
      : document.createElement(fiber.type)

  updateDom(dom, {}, fiber.props)
  return dom
}

// ── 2.3 performUnitOfWork ────────────────────────────────────

function performUnitOfWork(fiber) {
  const isFunctionComponent = fiber.type instanceof Function
  if (isFunctionComponent) {
    updateFunctionComponent(fiber)
  } else {
    updateHostComponent(fiber)
  }

  // Traversal: child → sibling → uncle
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

// ── 3.1 Commit Phase ─────────────────────────────────────────

function render(element, container) {
  wipRoot = {
    dom:       container,
    props:     { children: [element] },
    alternate: currentRoot,
  }
  deletions      = []
  nextUnitOfWork = wipRoot
}

function commitRoot() {
  deletions.forEach(commitWork)
  commitWork(wipRoot.child)
  currentRoot = wipRoot
  wipRoot     = null
}

function commitWork(fiber) {
  if (!fiber) return

  let domParentFiber = fiber.parent
  while (!domParentFiber.dom) {
    domParentFiber = domParentFiber.parent
  }
  const domParent = domParentFiber.dom

  if (fiber.effectTag === "PLACEMENT" && fiber.dom != null) {
    domParent.appendChild(fiber.dom)
  } else if (fiber.effectTag === "UPDATE" && fiber.dom != null) {
    updateDom(fiber.dom, fiber.alternate.props, fiber.props)
  } else if (fiber.effectTag === "DELETION") {
    commitDeletion(fiber, domParent)
  }

  commitWork(fiber.child)
  commitWork(fiber.sibling)
}

function commitDeletion(fiber, domParent) {
  if (fiber.dom) {
    domParent.removeChild(fiber.dom)
  } else {
    commitDeletion(fiber.child, domParent)
  }
}

// ── 3.2 updateDom ────────────────────────────────────────────

const isEvent    = key => key.startsWith("on")
const isProperty = key => key !== "children" && !isEvent(key)
const isNew      = (prev, next) => key => prev[key] !== next[key]
const isGone     = (prev, next) => key => !(key in next)

function updateDom(dom, prevProps, nextProps) {
  // Remove stale event listeners before adding new ones
  Object.keys(prevProps)
    .filter(isEvent)
    .filter(key => isGone(prevProps, nextProps)(key) || isNew(prevProps, nextProps)(key))
    .forEach(name => {
      dom.removeEventListener(name.toLowerCase().substring(2), prevProps[name])
    })

  // Clear props that disappeared
  Object.keys(prevProps)
    .filter(isProperty)
    .filter(isGone(prevProps, nextProps))
    .forEach(name => { dom[name] = "" })

  // Apply new or changed props
  Object.keys(nextProps)
    .filter(isProperty)
    .filter(isNew(prevProps, nextProps))
    .forEach(name => { dom[name] = nextProps[name] })

  // Attach new or updated event listeners
  Object.keys(nextProps)
    .filter(isEvent)
    .filter(isNew(prevProps, nextProps))
    .forEach(name => {
      dom.addEventListener(name.toLowerCase().substring(2), nextProps[name])
    })
}

// ── 3.3 reconcileChildren ────────────────────────────────────

function reconcileChildren(wipFiber, elements) {
  let index       = 0
  let oldFiber    = wipFiber.alternate && wipFiber.alternate.child
  let prevSibling = null

  while (index < elements.length || oldFiber != null) {
    const element = elements[index]
    let newFiber  = null

    const sameType = oldFiber && element && element.type === oldFiber.type

    // Same type → recycle the DOM node, patch the props
    if (sameType) {
      newFiber = {
        type:      oldFiber.type,
        props:     element.props,
        dom:       oldFiber.dom,
        parent:    wipFiber,
        alternate: oldFiber,
        effectTag: "UPDATE",
      }
    }

    // New element, no match → create a fresh DOM node
    if (element && !sameType) {
      newFiber = {
        type:      element.type,
        props:     element.props,
        dom:       null,
        parent:    wipFiber,
        alternate: null,
        effectTag: "PLACEMENT",
      }
    }

    // Old fiber without a match → schedule removal
    if (oldFiber && !sameType) {
      oldFiber.effectTag = "DELETION"
      deletions.push(oldFiber)
    }

    if (oldFiber) oldFiber = oldFiber.sibling

    if (index === 0) {
      wipFiber.child = newFiber
    } else if (element) {
      prevSibling.sibling = newFiber
    }

    prevSibling = newFiber
    index++
  }
}

// ── 4.1 updateFunctionComponent ──────────────────────────────

function updateFunctionComponent(fiber) {
  wipFiber  = fiber
  hookIndex = 0
  wipFiber.hooks = []

  const children = [fiber.type(fiber.props)]
  reconcileChildren(fiber, children)
}

// ── 4.2 useState ─────────────────────────────────────────────

function useState(initial) {
  // Step 1: Retrieve old hook at this index from the previous render
  const oldHook =
    wipFiber.alternate &&
    wipFiber.alternate.hooks &&
    wipFiber.alternate.hooks[hookIndex]

  // Step 2: Initialize — reuse old state or fall back to initial value
  const hook = {
    state: oldHook ? oldHook.state : initial,
    queue: [],
  }

  // Step 3: Batch — apply all queued actions to compute the new state
  const actions = oldHook ? oldHook.queue : []
  actions.forEach(action => {
    hook.state = typeof action === "function"
      ? action(hook.state)
      : action
  })

  // Step 4: setState — queues an action and schedules a re-render
  const setState = action => {
    hook.queue.push(action)
    wipRoot = {
      dom:       currentRoot.dom,
      props:     currentRoot.props,
      alternate: currentRoot,
    }
    deletions      = []
    nextUnitOfWork = wipRoot
  }

  // Step 5: Register hook and advance cursor
  wipFiber.hooks.push(hook)
  hookIndex++

  return [hook.state, setState]
}

const Didact = { createElement, render, useState }