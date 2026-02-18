import { motion, useMotionValue, useTransform } from 'framer-motion';
import type { PanInfo } from 'framer-motion';
import type { Quote } from '../types/Quote';
import { TagBadge } from './TagBadge';
import './QuoteCard.css';

interface QuoteCardProps {
  quote: Quote;
  currentIndex: number;
  totalCount: number;
  onSwipeUp: () => void;
  onSwipeDown: (quote: Quote) => void;
}

export function QuoteCard({
  quote,
  currentIndex,
  totalCount,
  onSwipeUp,
  onSwipeDown
}: QuoteCardProps) {
  const y = useMotionValue(0);
  const x = useMotionValue(0);

  const rotate = useTransform(x, [-200, 200], [-10, 10]);
  const scale = useTransform(y, [-300, 0, 300], [0.85, 1, 0.85]);

  const swipeUpOpacity = useTransform(y, [-100, -50, 0], [1, 0.5, 0]);
  const swipeDownOpacity = useTransform(y, [0, 50, 100], [0, 0.5, 1]);

  const SWIPE_THRESHOLD = 100;

  const handleDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const offsetY = info.offset.y;
    const velocityY = info.velocity.y;

    if (offsetY < -SWIPE_THRESHOLD || velocityY < -500) {
      onSwipeUp();
    } else if (offsetY > SWIPE_THRESHOLD || velocityY > 500) {
      onSwipeDown(quote);
    }
  };

  return (
    <motion.div
      className="quote-card"
      style={{ x, y, rotate, scale }}
      drag
      dragConstraints={{ left: 0, right: 0, top: -300, bottom: 300 }}
      dragElastic={0.7}
      onDragEnd={handleDragEnd}
      initial={{ scale: 0.95, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{
        y: -1000,
        opacity: 0,
        transition: { duration: 0.3 }
      }}
    >
      {/* Swipe indicators */}
      <motion.div className="swipe-indicator swipe-skip" style={{ opacity: swipeUpOpacity }}>
        SKIP
      </motion.div>
      <motion.div className="swipe-indicator swipe-save" style={{ opacity: swipeDownOpacity }}>
        SAVE
      </motion.div>

      {/* Counter */}
      <div className="card-header">
        <span className="card-counter">{currentIndex + 1} / {totalCount}</span>
      </div>

      {/* Quote text */}
      <div className="quote-text-wrapper">
        <p className="quote-text">&#x201C;{quote.text}&#x201D;</p>
      </div>

      {/* Attribution */}
      <div className="quote-attribution">
        <span className="quote-author">{quote.author}</span>
        {quote.source && <span className="quote-source">{quote.source}</span>}
      </div>

      {/* Topic badges */}
      <div className="card-topics">
        {quote.topics.slice(0, 4).map((topic, i) => (
          <TagBadge key={i} tag={topic} size="small" />
        ))}
      </div>
    </motion.div>
  );
}
