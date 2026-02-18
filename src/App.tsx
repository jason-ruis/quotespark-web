import { useState, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import type { Quote } from './types/Quote';
import { loadQuotes, shuffleQuotes } from './services/quoteService';
import { QuoteCard } from './components/QuoteCard';
import { FavoritesView } from './components/FavoritesView';
import { Login } from './components/Login';
import './App.css';

type View = 'browse' | 'favorites';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return localStorage.getItem('quotespark_auth') === 'true';
  });
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [view, setView] = useState<View>('browse');
  const [favorites, setFavorites] = useState<Quote[]>(() => {
    return JSON.parse(localStorage.getItem('quotespark_favorites') || '[]') as Quote[];
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const allQuotes = loadQuotes();
    setQuotes(shuffleQuotes(allQuotes));
    setIsLoading(false);
  }, []);

  const advance = () => {
    if (currentIndex < quotes.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      // Reshuffled and start over
      setQuotes(shuffleQuotes(quotes));
      setCurrentIndex(0);
    }
  };

  const handleSkip = () => {
    advance();
  };

  const handleSave = (quote: Quote) => {
    const alreadySaved = favorites.some(f => f.id === quote.id);
    if (!alreadySaved) {
      const updated = [...favorites, quote];
      setFavorites(updated);
      localStorage.setItem('quotespark_favorites', JSON.stringify(updated));
    }
    advance();
  };

  const handleRemoveFavorite = (quoteId: string) => {
    const updated = favorites.filter(f => f.id !== quoteId);
    setFavorites(updated);
    localStorage.setItem('quotespark_favorites', JSON.stringify(updated));
  };

  if (!isAuthenticated) {
    return <Login onLogin={() => setIsAuthenticated(true)} />;
  }

  if (isLoading) {
    return (
      <div className="app loading">
        <div className="spinner" />
        <p>Loading quotes...</p>
      </div>
    );
  }

  if (quotes.length === 0) {
    return (
      <div className="app empty">
        <h2>No Quotes Found</h2>
        <p>Run <code>npm run fetch-quotes</code> to populate the database.</p>
        <p className="hint">Or push to GitHub to trigger the Actions workflow.</p>
      </div>
    );
  }

  if (view === 'favorites') {
    return (
      <div className="app">
        <FavoritesView
          favorites={favorites}
          onRemove={handleRemoveFavorite}
          onBack={() => setView('browse')}
        />
      </div>
    );
  }

  const currentQuote = quotes[currentIndex];

  return (
    <div className="app">
      <header className="app-header">
        <h1>QuoteSpark</h1>
        <button
          className="favorites-button"
          onClick={() => setView('favorites')}
        >
          Saved {favorites.length > 0 && <span className="favorites-badge">{favorites.length}</span>}
        </button>
      </header>

      <main className="app-main">
        <AnimatePresence mode="wait">
          {currentQuote && (
            <QuoteCard
              key={currentQuote.id}
              quote={currentQuote}
              currentIndex={currentIndex}
              totalCount={quotes.length}
              onSwipeUp={handleSkip}
              onSwipeDown={handleSave}
            />
          )}
        </AnimatePresence>
      </main>

      <footer className="app-footer">
        <p>Swipe up to skip&nbsp;&nbsp;·&nbsp;&nbsp;Swipe down to save</p>
      </footer>
    </div>
  );
}

export default App;
