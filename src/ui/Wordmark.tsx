import { BrandMark } from './icons';

/** App logotype: original ball/monkey mark beside rounded bold type. */
export function Wordmark() {
  return (
    <span className="wordmark" title="Monkey Ball Workshop">
      <BrandMark size={26} filled className="wordmark-ball" />
      <span className="wordmark-text">
        <span className="wordmark-lead">Monkey Ball</span>
        <span className="wordmark-sub">Workshop</span>
      </span>
    </span>
  );
}
