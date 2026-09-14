import { useEffect, useMemo, useState } from 'react'
import './App.css'
import { hasSupabaseConfig, supabase } from './lib/supabase'

const defaultMovieForm = {
  title: '',
  genre: '',
  year: '',
  rating: '',
  status: 'plan_to_watch',
  watched: false,
  notes: '',
  poster_url: '',
  imdb_id: '',
}

const statusMeta = {
  plan_to_watch: { label: 'Plan to watch', accent: 'neutral' },
  watching: { label: 'Watching', accent: 'info' },
  watched: { label: 'Watched', accent: 'success' },
}

const parseRating = (value) => {
  if (value === '' || value === null || value === undefined) return null

  const rating = Math.round(Number(value) * 10) / 10
  return Number.isFinite(rating) ? rating : null
}

const formatRatingLabel = (value) => {
  const rating = Number(value)
  if (!Number.isFinite(rating)) return 'No rating yet'
  return `${rating.toFixed(1)}/10`
}

const describeWatchlistError = (error, action) => {
  const message = error?.message || ''
  const lowerMessage = message.toLowerCase()
  const code = error?.code || ''

  if (code === '42501' || lowerMessage.includes('permission denied')) {
    return 'Supabase is blocking this because signed-in users were never granted table access. Open the SQL Editor, run supabase-schema.sql (especially the GRANT statements), then try again.'
  }

  if (
    lowerMessage.includes('row-level security') ||
    lowerMessage.includes('row level security') ||
    lowerMessage.includes('not allowed to')
  ) {
    return `Supabase Row Level Security blocked this ${action}. Run the policies in supabase-schema.sql and stay signed in.`
  }

  return message
}

function App() {
  const [authMode, setAuthMode] = useState('sign-in')
  const [authForm, setAuthForm] = useState({
    fullName: '',
    email: '',
    password: '',
  })
  const [session, setSession] = useState(null)
  const [movies, setMovies] = useState([])
  const [movieForm, setMovieForm] = useState(defaultMovieForm)
  const [editingId, setEditingId] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [schemaWarning, setSchemaWarning] = useState('')
  const [loading, setLoading] = useState(true)
  const [movieLoading, setMovieLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searchLoading, setSearchLoading] = useState(false)

  const omdbApiKey = import.meta.env.VITE_OMDB_API_KEY

  const stats = useMemo(() => {
    return {
      total: movies.length,
      watched: movies.filter((movie) => movie.watched).length,
      plan: movies.filter((movie) => !movie.watched).length,
    }
  }, [movies])

  const loadMovies = async (userId) => {
    setMovieLoading(true)
    setError('')
    setSchemaWarning('')

    const { data, error: movieError } = await supabase
      .from('movie_watchlist')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (movieError) {
      const message = movieError.message || ''

      if (
        message.includes('could not find public.movie_watchlist in the schema cache') ||
        message.includes('does not exist') ||
        message.includes('relation')
      ) {
        setSchemaWarning(
          'The Supabase table is missing. Create it using the SQL in supabase-schema.sql, then refresh the page.',
        )
        setMovies([])
      } else {
        setError(describeWatchlistError(movieError, 'read'))
        setMovies([])
      }
    } else {
      setMovies(data ?? [])
    }

    setMovieLoading(false)
  }

  useEffect(() => {
    let isMounted = true

    const initAuthState = async () => {
      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession()

      if (!isMounted) return

      setSession(currentSession)

      if (currentSession) {
        await loadMovies(currentSession.user.id)
      } else {
        setMovies([])
      }

      setLoading(false)
    }

    initAuthState()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, currentSession) => {
      setSession(currentSession)

      if (currentSession) {
        await loadMovies(currentSession.user.id)
      } else {
        setMovies([])
      }
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [])

  const handleAuthFieldChange = (event) => {
    const { name, value } = event.target
    setAuthForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleMovieFieldChange = (event) => {
    const { name, value, type, checked } = event.target

    setMovieForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  const handleAuthSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setNotice('')

    const { fullName, email, password } = authForm

    if (!email.trim() || !password.trim()) {
      setError('Please enter your email and password.')
      return
    }

    try {
      if (authMode === 'sign-up') {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              full_name: fullName.trim() || email.split('@')[0],
            },
          },
        })

        if (signUpError) {
          setError(signUpError.message)
          return
        }

        if (!data.session) {
          setNotice('Account created! Check your inbox for a confirmation email before signing in.')
          setAuthMode('sign-in')
          setAuthForm((prev) => ({ ...prev, password: '', fullName: '' }))
          return
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        })

        if (signInError) {
          setError(signInError.message)
          return
        }
      }
    } catch (submitError) {
      setError(submitError.message)
    }
  }

  const handleSignOut = async () => {
    setError('')
    setNotice('')

    const { error: signOutError } = await supabase.auth.signOut()

    if (signOutError) {
      setError(signOutError.message)
    }
  }

  const resetMovieForm = () => {
    setMovieForm(defaultMovieForm)
    setEditingId(null)
    setSearchResults([])
    setSearchQuery('')
  }

  const searchForMovie = async (event) => {
    event.preventDefault()
    setError('')
    setNotice('')

    if (!omdbApiKey) {
      setError('Add VITE_OMDB_API_KEY to your .env file to enable poster lookup.')
      return
    }

    const trimmedQuery = searchQuery.trim()
    if (!trimmedQuery) {
      setError('Enter a movie title to search.')
      return
    }

    setSearchLoading(true)

    try {
      const response = await fetch(
        `https://www.omdbapi.com/?apikey=${omdbApiKey}&s=${encodeURIComponent(trimmedQuery)}`,
      )
      const data = await response.json()

      if (data.Response !== 'True') {
        setSearchResults([])
        setError(data.Error || 'No matching movies were found.')
        return
      }

      setSearchResults((data.Search || []).slice(0, 5))
      setNotice(`Showing ${Math.min((data.Search || []).length, 5)} movie matches.`)
    } catch (queryError) {
      setError(queryError.message)
    } finally {
      setSearchLoading(false)
    }
  }

  const applySearchResult = async (movieResult) => {
    if (!omdbApiKey) {
      setError('Add VITE_OMDB_API_KEY to your .env file to enable poster lookup.')
      return
    }

    try {
      const response = await fetch(
        `https://www.omdbapi.com/?apikey=${omdbApiKey}&i=${encodeURIComponent(movieResult.imdbID)}`,
      )
      const details = await response.json()

      const cleanedYear = details.Year && details.Year !== 'N/A' ? String(details.Year).replace(/\D/g, '') : ''
      const cleanedRating =
        details.imdbRating && details.imdbRating !== 'N/A' ? String(Number(details.imdbRating)) : ''
      const genre = details.Genre && details.Genre !== 'N/A' ? details.Genre.split(',')[0].trim() : ''
      const posterUrl = details.Poster && details.Poster !== 'N/A' ? details.Poster : ''

      setMovieForm((prev) => ({
        ...prev,
        title: details.Title || prev.title,
        year: cleanedYear,
        genre: genre || prev.genre,
        rating: cleanedRating || prev.rating,
        poster_url: posterUrl || prev.poster_url,
        imdb_id: details.imdbID || prev.imdb_id,
        notes: prev.notes || (details.Plot && details.Plot !== 'N/A' ? details.Plot : ''),
      }))

      setSearchResults([])
      setSearchQuery('')
      setNotice('Movie details loaded with poster.')
    } catch (lookupError) {
      setError(lookupError.message)
    }
  }

  const handleMovieSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setNotice('')

    if (!session?.user) {
      setError('Please sign in to save movies.')
      return
    }

    const title = movieForm.title.trim()

    if (!title) {
      setError('A movie title is required.')
      return
    }

    const rating = parseRating(movieForm.rating)

    if (movieForm.rating !== '' && (rating === null || rating < 0 || rating > 10)) {
      setError('Rating must be a number between 0 and 10. Decimals like 8.7 are allowed.')
      return
    }

    const payload = {
      user_id: session.user.id,
      title,
      genre: movieForm.genre.trim() || 'General',
      year: movieForm.year ? Number(movieForm.year) : null,
      rating,
      status: movieForm.status,
      watched: Boolean(movieForm.watched),
      notes: movieForm.notes.trim(),
      poster_url: movieForm.poster_url || null,
      imdb_id: movieForm.imdb_id || null,
    }

    try {
      if (editingId) {
        const { error: updateError } = await supabase
          .from('movie_watchlist')
          .update(payload)
          .eq('id', editingId)
          .eq('user_id', session.user.id)

        if (updateError) {
          setError(describeWatchlistError(updateError, 'update'))
          return
        }

        setNotice('Movie updated.')
      } else {
        const { error: insertError } = await supabase.from('movie_watchlist').insert([payload])

        if (insertError) {
          setError(describeWatchlistError(insertError, 'insert'))
          return
        }

        setNotice('Movie added to your watchlist.')
      }

      resetMovieForm()
      await loadMovies(session.user.id)
    } catch (submitError) {
      setError(submitError.message)
    }
  }

  const handleEditMovie = (movie) => {
    setEditingId(movie.id)
    setMovieForm({
      title: movie.title,
      genre: movie.genre || '',
      year: movie.year || '',
      rating: movie.rating || '',
      status: movie.status || 'plan_to_watch',
      watched: Boolean(movie.watched),
      notes: movie.notes || '',
      poster_url: movie.poster_url || '',
      imdb_id: movie.imdb_id || '',
    })
    setSearchResults([])
  }

  const handleDeleteMovie = async (movieId) => {
    if (!session?.user) return

    const confirmed = window.confirm('Delete this movie from your watchlist?')
    if (!confirmed) return

    const { error: deleteError } = await supabase
      .from('movie_watchlist')
      .delete()
      .eq('id', movieId)
      .eq('user_id', session.user.id)

    if (deleteError) {
      setError(describeWatchlistError(deleteError, 'delete'))
      return
    }

    setNotice('Movie removed.')
    setMovies((currentMovies) => currentMovies.filter((movie) => movie.id !== movieId))
  }

  const toggleWatched = async (movie) => {
    if (!session?.user) return

    const updatedWatched = !movie.watched

    const { error: updateError } = await supabase
      .from('movie_watchlist')
      .update({
        watched: updatedWatched,
        status: updatedWatched ? 'watched' : 'plan_to_watch',
      })
      .eq('id', movie.id)
      .eq('user_id', session.user.id)

    if (updateError) {
      setError(describeWatchlistError(updateError, 'update'))
      return
    }

    setMovies((currentMovies) =>
      currentMovies.map((current) =>
        current.id === movie.id
          ? {
              ...current,
              watched: updatedWatched,
              status: updatedWatched ? 'watched' : 'plan_to_watch',
            }
          : current,
      ),
    )
  }

  if (loading) {
    return <div className="loading-shell">Loading your watchlist…</div>
  }

  return (
    <div className="page-shell">
      {!session ? (
        <div className="auth-shell">
          <div className="auth-card">
            <div className="brand-row">
              <div className="brand-icon">🎬</div>
              <div>
                <p className="eyebrow">Movie Night</p>
                <h1>Watchlist</h1>
              </div>
            </div>

            {!hasSupabaseConfig && (
              <div className="config-warning">
                Add your Supabase URL and anon key to the VITE_SUPABASE_* environment variables before signing in.
              </div>
            )}

            <div className="tab-toggle" role="tablist" aria-label="Authentication options">
              <button
                type="button"
                className={authMode === 'sign-in' ? 'active' : ''}
                onClick={() => setAuthMode('sign-in')}
              >
                Sign in
              </button>
              <button
                type="button"
                className={authMode === 'sign-up' ? 'active' : ''}
                onClick={() => setAuthMode('sign-up')}
              >
                Register
              </button>
            </div>

            <form onSubmit={handleAuthSubmit} className="auth-form">
              {authMode === 'sign-up' && (
                <label>
                  Full name
                  <input
                    type="text"
                    name="fullName"
                    value={authForm.fullName}
                    onChange={handleAuthFieldChange}
                    placeholder="Your name"
                  />
                </label>
              )}

              <label>
                Email
                <input
                  type="email"
                  name="email"
                  value={authForm.email}
                  onChange={handleAuthFieldChange}
                  placeholder="you@example.com"
                  autoComplete="email"
                />
              </label>

              <label>
                Password
                <input
                  type="password"
                  name="password"
                  value={authForm.password}
                  onChange={handleAuthFieldChange}
                  placeholder="••••••••"
                  autoComplete={authMode === 'sign-up' ? 'new-password' : 'current-password'}
                />
              </label>

              {error && <div className="alert error">{error}</div>}
              {notice && <div className="alert success">{notice}</div>}

              <button type="submit" className="primary-button">
                {authMode === 'sign-up' ? 'Create account' : 'Sign in'}
              </button>
            </form>
          </div>
        </div>
      ) : (
        <div className="dashboard-shell">
          <header className="topbar">
            <div>
              <p className="eyebrow">Your cinema log</p>
              <h2>Movie watchlist</h2>
            </div>

            <div className="topbar-actions">
              <span className="user-badge">{session.user.email}</span>
              <button type="button" className="secondary-button" onClick={handleSignOut}>
                Sign out
              </button>
            </div>
          </header>

          <section className="stats-grid">
            <div className="stat-card">
              <span>Total movies</span>
              <strong>{stats.total}</strong>
            </div>
            <div className="stat-card">
              <span>Watched</span>
              <strong>{stats.watched}</strong>
            </div>
            <div className="stat-card">
              <span>To watch</span>
              <strong>{stats.plan}</strong>
            </div>
          </section>

          {schemaWarning && <div className="alert error schema-warning">{schemaWarning}</div>}

          <div className="content-grid">
            <section className="panel">
              <div className="panel-header">
                <h3>{editingId ? 'Edit movie' : 'Add a movie'}</h3>
                {editingId && (
                  <button type="button" className="text-button" onClick={resetMovieForm}>
                    Cancel
                  </button>
                )}
              </div>

              <form onSubmit={searchForMovie} className="movie-search-form">
                <label>
                  Search movie database
                  <div className="search-row">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      placeholder="Search by title…"
                    />
                    <button type="submit" className="secondary-button" disabled={searchLoading}>
                      {searchLoading ? 'Searching...' : 'Search'}
                    </button>
                  </div>
                </label>
              </form>

              {searchResults.length > 0 && (
                <div className="search-results">
                  {searchResults.map((result) => (
                    <button
                      type="button"
                      key={result.imdbID}
                      className="search-result-card"
                      onClick={() => applySearchResult(result)}
                    >
                      <img src={result.Poster !== 'N/A' ? result.Poster : 'https://via.placeholder.com/80x120?text=No+Poster'} alt={result.Title} />
                      <div>
                        <strong>{result.Title}</strong>
                        <span>{result.Year}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {movieForm.poster_url && (
                <div className="poster-preview-wrap">
                  <img src={movieForm.poster_url} alt={movieForm.title || 'Movie poster'} className="poster-preview" />
                </div>
              )}

              <form onSubmit={handleMovieSubmit} className="movie-form">
                <label>
                  Title
                  <input
                    type="text"
                    name="title"
                    value={movieForm.title}
                    onChange={handleMovieFieldChange}
                    placeholder="The Matrix"
                  />
                </label>

                <div className="two-column">
                  <label>
                    Genre
                    <input
                      type="text"
                      name="genre"
                      value={movieForm.genre}
                      onChange={handleMovieFieldChange}
                      placeholder="Sci-Fi"
                    />
                  </label>

                  <label>
                    Year
                    <input
                      type="number"
                      name="year"
                      min="1900"
                      max="2100"
                      value={movieForm.year}
                      onChange={handleMovieFieldChange}
                      placeholder="1999"
                    />
                  </label>
                </div>

                <div className="two-column">
                  <label>
                    Rating
                    <input
                      type="number"
                      name="rating"
                      min="0"
                      max="10"
                      step="any"
                      inputMode="decimal"
                      value={movieForm.rating}
                      onChange={handleMovieFieldChange}
                      placeholder="8.7"
                    />
                  </label>

                  <label>
                    Status
                    <select name="status" value={movieForm.status} onChange={handleMovieFieldChange}>
                      <option value="plan_to_watch">Plan to watch</option>
                      <option value="watching">Watching</option>
                      <option value="watched">Watched</option>
                    </select>
                  </label>
                </div>

                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    name="watched"
                    checked={movieForm.watched}
                    onChange={handleMovieFieldChange}
                  />
                  Mark as watched
                </label>

                <label>
                  Poster URL
                  <input
                    type="url"
                    name="poster_url"
                    value={movieForm.poster_url}
                    onChange={handleMovieFieldChange}
                    placeholder="https://...jpg"
                  />
                </label>

                <label>
                  Notes
                  <textarea
                    name="notes"
                    value={movieForm.notes}
                    onChange={handleMovieFieldChange}
                    placeholder="Favorite scene, who recommended it, or a review note..."
                    rows="4"
                  />
                </label>

                {error && <div className="alert error">{error}</div>}
                {notice && <div className="alert success">{notice}</div>}

                <button type="submit" className="primary-button">
                  {editingId ? 'Save updates' : 'Add movie'}
                </button>
              </form>
            </section>

            <section className="panel">
              <div className="panel-header">
                <h3>Watchlist</h3>
              </div>

              {movieLoading ? (
                <p className="empty-state">Loading movies…</p>
              ) : movies.length === 0 ? (
                <p className="empty-state">Your watchlist is empty. Add your first movie above.</p>
              ) : (
                <div className="movie-list">
                  {movies.map((movie) => (
                    <article key={movie.id} className="movie-card">
                      <div className="movie-header-row">
                        {movie.poster_url && (
                          <img src={movie.poster_url} alt={movie.title} className="movie-poster" />
                        )}

                        <div className="movie-body">
                          <div className="movie-header">
                            <div>
                              <h4>{movie.title}</h4>
                              <p>
                                {movie.year || 'Year unknown'} • {movie.genre || 'General'}
                              </p>
                            </div>

                            <span className={`status-pill ${statusMeta[movie.status]?.accent || 'neutral'}`}>
                              {statusMeta[movie.status]?.label || 'Plan to watch'}
                            </span>
                          </div>

                          {movie.notes && <p className="movie-notes">{movie.notes}</p>}

                          <div className="movie-details">
                            <span>⭐ {formatRatingLabel(movie.rating)}</span>
                            <span>{movie.watched ? 'Watched' : 'Not watched yet'}</span>
                          </div>

                          <div className="movie-actions">
                            <button type="button" className="secondary-button" onClick={() => toggleWatched(movie)}>
                              {movie.watched ? 'Mark unwatched' : 'Mark watched'}
                            </button>
                            <button type="button" className="secondary-button" onClick={() => handleEditMovie(movie)}>
                              Edit
                            </button>
                            <button type="button" className="danger-button" onClick={() => handleDeleteMovie(movie.id)}>
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
