import { useState } from 'react';

export function CounterLoad({
  children,
  initialCount = 0,
}: {
  children?: React.ReactNode;
  initialCount?: number;
}) {
  const [count, setCount] = useState(initialCount);
  const add = () => setCount(i => i + 1);
  const subtract = () => setCount(i => i - 1);

  return (
    <div>
      <div className="counter-message">load</div>
      <div>children: {children}</div>
      <div className="counter">
        <button onClick={subtract}>-</button>
        <pre>{count}</pre>
        <button onClick={add}>+</button>
      </div>
      <style jsx>{`
        .counter-message {
          color: cadetblue;
        }
        .counter {
          display: flex;
          justify-content: center;
          align-items: center;
          margin-bottom: 20px;
        }
      `}</style>
    </div>
  );
}
