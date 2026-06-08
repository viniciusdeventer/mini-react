/** @jsx Didact.createElement */

function Counter() {
  const [count, setCount] = Didact.useState(1)

  return (
    <div style="position: fixed; inset: 0; display: flex; align-items: center; justify-content: center; font-family: sans-serif; background: #f1f5f9; overflow: hidden;">
      <div style="text-align: center; padding: 24px 28px; border-radius: 12px; background: white; box-shadow: 0 8px 24px rgba(0,0,0,0.08);">
        <h1 style="margin: 0 0 16px;">
          Count: {count}
        </h1>

        <div style="display: flex; gap: 10px; justify-content: center;">
          <button
            onClick={() => setCount(c => c + 1)}
            style="padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; cursor: pointer;"
          >
            + Increment
          </button>

          <button
            onClick={() => setCount(c => c - 1)}
            style="padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; cursor: pointer;"
          >
            - Decrement
          </button>
        </div>
      </div>
    </div>
  )
}

const container = document.getElementById("root")
Didact.render(<Counter />, container)