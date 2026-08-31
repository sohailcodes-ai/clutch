'use client'

import { useEffect, useState, useCallback } from 'react'
import { api, type SessionUser } from '../../lib/api'
import { useWs, type ConnectionStatus } from '../../lib/ws'
import { useSession } from '../../lib/session'

type Friend = {
  id: string
  userId: string
  handle: string
  displayName: string | null
  avatarUrl: string | null
  status: 'online' | 'offline' | 'queued' | 'in_match'
  friendshipSince: string
}

type FriendRequest = {
  id: string
  requesterId: string
  addresseeId: string
  status: string
  createdAt: string
  requesterHandle?: string
  requesterDisplayName?: string | null
  addresseeHandle?: string
  addresseeDisplayName?: string | null
}

export default function FriendsPage() {
  const { user } = useSession()
  const [friends, setFriends] = useState<Friend[]>([])
  const [incomingRequests, setIncomingRequests] = useState<FriendRequest[]>([])
  const [outgoingRequests, setOutgoingRequests] = useState<FriendRequest[]>([])
  const [tab, setTab] = useState<'friends' | 'requests'>('friends')
  const [searchHandle, setSearchHandle] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [challengeModal, setChallengeModal] = useState<Friend | null>(null)

  const { subscribe } = useWs({
    onMessage: (msg) => {
      if (msg.type === 'friend.request') {
        loadRequests()
      } else if (msg.type === 'friend.accepted') {
        loadFriends()
        loadRequests()
      } else if (msg.type === 'friend.removed') {
        loadFriends()
      } else if (msg.type === 'presence.updated' && msg.payload) {
        const { userId, state } = msg.payload as { userId: string; state: string }
        setFriends((prev) =>
          prev.map((f) =>
            f.userId === userId ? { ...f, status: state as Friend['status'] } : f,
          ),
        )
      }
    },
  })

  const loadFriends = useCallback(async () => {
    try {
      const res = await api.get<{ friends: Friend[] }>('/friends')
      setFriends(res.friends)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load friends')
    }
  }, [])

  const loadRequests = useCallback(async () => {
    try {
      const res = await api.get<{
        incoming: FriendRequest[]
        outgoing: FriendRequest[]
      }>('/friends/requests')
      setIncomingRequests(res.incoming)
      setOutgoingRequests(res.outgoing)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load requests')
    }
  }, [])

  useEffect(() => {
    if (!user) return
    Promise.all([loadFriends(), loadRequests()]).finally(() => setLoading(false))
    subscribe('friends.subscribe')
  }, [user, loadFriends, loadRequests, subscribe])

  const sendFriendRequest = async () => {
    if (!searchHandle.trim()) return
    setError(null)
    try {
      await api.post('/friends/request', { handle: searchHandle.trim() })
      setSearchHandle('')
      loadRequests()
    } catch (err: any) {
      setError(err.message || 'Failed to send request')
    }
  }

  const acceptRequest = async (userId: string) => {
    try {
      await api.post(`/friends/${userId}/accept`)
      loadFriends()
      loadRequests()
    } catch (err: any) {
      setError(err.message || 'Failed to accept')
    }
  }

  const declineRequest = async (userId: string) => {
    try {
      await api.post(`/friends/${userId}/decline`)
      loadRequests()
    } catch (err: any) {
      setError(err.message || 'Failed to decline')
    }
  }

  const removeFriend = async (userId: string) => {
    try {
      await api.delete(`/friends/${userId}`)
      loadFriends()
    } catch (err: any) {
      setError(err.message || 'Failed to remove friend')
    }
  }

  const statusColor = (status: Friend['status']) => {
    switch (status) {
      case 'online': return 'text-emerald-400'
      case 'queued': return 'text-amber-400'
      case 'in_match': return 'text-red-400'
      default: return 'text-zinc-500'
    }
  }

  const statusLabel = (status: Friend['status']) => {
    switch (status) {
      case 'online': return 'ONLINE'
      case 'queued': return 'QUEUED'
      case 'in_match': return 'IN MATCH'
      default: return 'OFFLINE'
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center">
        <div className="text-zinc-400">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">FRIENDS</h1>

        {error && (
          <div className="bg-red-900/20 border border-red-800 text-red-300 px-4 py-2 rounded mb-4 text-sm">
            {error}
            <button onClick={() => setError(null)} className="ml-2 underline">dismiss</button>
          </div>
        )}

        {/* Search / Add friend */}
        <div className="flex gap-2 mb-6">
          <input
            type="text"
            value={searchHandle}
            onChange={(e) => setSearchHandle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendFriendRequest()}
            placeholder="Add friend by handle..."
            className="flex-1 bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
          />
          <button
            onClick={sendFriendRequest}
            className="bg-zinc-800 border border-zinc-700 rounded px-4 py-2 text-sm hover:bg-zinc-700 transition-colors"
          >
            Add
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mb-4 border-b border-zinc-800">
          <button
            onClick={() => setTab('friends')}
            className={`pb-2 text-sm font-medium border-b-2 transition-colors ${
              tab === 'friends'
                ? 'border-zinc-100 text-zinc-100'
                : 'border-transparent text-zinc-500 hover:text-zinc-300'
            }`}
          >
            Friends ({friends.length})
          </button>
          <button
            onClick={() => setTab('requests')}
            className={`pb-2 text-sm font-medium border-b-2 transition-colors ${
              tab === 'requests'
                ? 'border-zinc-100 text-zinc-100'
                : 'border-transparent text-zinc-500 hover:text-zinc-300'
            }`}
          >
            Requests ({incomingRequests.length})
          </button>
        </div>

        {/* Friends List */}
        {tab === 'friends' && (
          <div className="space-y-1">
            {friends.length === 0 ? (
              <div className="text-zinc-500 text-sm py-8 text-center">No friends yet</div>
            ) : (
              friends.map((friend) => (
                <div
                  key={friend.id}
                  className="flex items-center justify-between px-3 py-2 rounded hover:bg-zinc-900 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-current" style={{ color: friend.status === 'online' ? '#34d399' : friend.status === 'in_match' ? '#f87171' : '#71717a' }} />
                    <div>
                      <div className="text-sm font-medium">{friend.displayName || friend.handle}</div>
                      <div className="text-xs text-zinc-500">
                        @{friend.handle} · <span className={statusColor(friend.status)}>{statusLabel(friend.status)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <a
                      href={`/profile/${friend.handle}`}
                      className="text-xs text-zinc-400 hover:text-zinc-200 px-2 py-1"
                    >
                      Profile
                    </a>
                    {friend.status !== 'offline' && (
                      <button
                        onClick={() => setChallengeModal(friend)}
                        className="text-xs bg-zinc-800 border border-zinc-700 rounded px-2 py-1 hover:bg-zinc-700 transition-colors"
                      >
                        Challenge
                      </button>
                    )}
                    <button
                      onClick={() => removeFriend(friend.userId)}
                      className="text-xs text-red-400 hover:text-red-300 px-2 py-1"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Requests */}
        {tab === 'requests' && (
          <div className="space-y-4">
            {incomingRequests.length > 0 && (
              <div>
                <h3 className="text-xs font-medium text-zinc-500 uppercase mb-2">Incoming</h3>
                {incomingRequests.map((req) => (
                  <div key={req.id} className="flex items-center justify-between px-3 py-2 rounded hover:bg-zinc-900">
                    <div className="text-sm">
                      <span className="font-medium">{req.requesterHandle}</span>
                      <span className="text-zinc-500 ml-2">sent you a friend request</span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => acceptRequest(req.requesterId)}
                        className="text-xs bg-emerald-900/30 border border-emerald-800 text-emerald-300 rounded px-2 py-1 hover:bg-emerald-900/50"
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => declineRequest(req.requesterId)}
                        className="text-xs text-zinc-400 hover:text-zinc-200 px-2 py-1"
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {outgoingRequests.length > 0 && (
              <div>
                <h3 className="text-xs font-medium text-zinc-500 uppercase mb-2">Sent</h3>
                {outgoingRequests.map((req) => (
                  <div key={req.id} className="flex items-center justify-between px-3 py-2 rounded">
                    <div className="text-sm">
                      <span className="text-zinc-400">Request to </span>
                      <span className="font-medium">{req.addresseeHandle}</span>
                      <span className="text-zinc-500 ml-2">· pending</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {incomingRequests.length === 0 && outgoingRequests.length === 0 && (
              <div className="text-zinc-500 text-sm py-8 text-center">No pending requests</div>
            )}
          </div>
        )}

        {/* Challenge Modal */}
        {challengeModal && (
          <ChallengeModal
            friend={challengeModal}
            onClose={() => setChallengeModal(null)}
          />
        )}
      </div>
    </div>
  )
}

function ChallengeModal({
  friend,
  onClose,
}: {
  friend: Friend
  onClose: () => void
}) {
  const [stackId, setStackId] = useState('python')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sendChallenge = async () => {
    setLoading(true)
    setError(null)
    try {
      await api.post('/challenges', { handle: friend.handle, stackId })
      onClose()
    } catch (err: any) {
      setError(err.message || 'Failed to send challenge')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 w-80"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold mb-4">Challenge {friend.displayName || friend.handle}</h2>

        {error && (
          <div className="bg-red-900/20 border border-red-800 text-red-300 px-3 py-2 rounded mb-4 text-sm">
            {error}
          </div>
        )}

        <div className="mb-4">
          <label className="text-xs text-zinc-500 uppercase block mb-1">Stack</label>
          <select
            value={stackId}
            onChange={(e) => setStackId(e.target.value)}
            className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm"
          >
            <option value="python">Python</option>
            <option value="javascript">JavaScript</option>
            <option value="typescript">TypeScript</option>
            <option value="java">Java</option>
            <option value="cpp">C++</option>
            <option value="go">Go</option>
            <option value="rust">Rust</option>
          </select>
        </div>

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm hover:bg-zinc-700"
          >
            Cancel
          </button>
          <button
            onClick={sendChallenge}
            disabled={loading}
            className="flex-1 bg-zinc-100 text-zinc-900 rounded px-3 py-2 text-sm font-medium hover:bg-white disabled:opacity-50"
          >
            {loading ? 'Sending...' : 'Send Challenge'}
          </button>
        </div>
      </div>
    </div>
  )
}
