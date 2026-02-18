import type { Quote } from '../types/Quote';
import './FavoritesView.css';

interface FavoritesViewProps {
  favorites: Quote[];
  onRemove: (quoteId: string) => void;
  onBack: () => void;
}

export function FavoritesView({ favorites, onRemove, onBack }: FavoritesViewProps) {
  const copyToClipboard = (quote: Quote) => {
    const text = `"${quote.text}" — ${quote.author}`;
    navigator.clipboard.writeText(text).catch(() => {});
  };

  return (
    <div className="favorites-view">
      <div className="favorites-header">
        <button className="back-button" onClick={onBack}>Back</button>
        <h2>Saved Quotes</h2>
        <span className="favorites-count">{favorites.length}</span>
      </div>

      {favorites.length === 0 ? (
        <div className="favorites-empty">
          <p>No saved quotes yet.</p>
          <p className="hint">Swipe down on a quote to save it.</p>
        </div>
      ) : (
        <div className="favorites-list">
          {favorites.map(quote => (
            <div
              key={quote.id}
              className="favorite-item"
              onClick={() => copyToClipboard(quote)}
              title="Tap to copy"
            >
              <div className="favorite-content">
                <p className="favorite-text">&#x201C;{quote.text}&#x201D;</p>
                <p className="favorite-author">{quote.author}</p>
                {quote.source && <p className="favorite-source">{quote.source}</p>}
              </div>
              <button
                className="remove-button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(quote.id);
                }}
                title="Remove from saved"
              >
                &#x2715;
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
