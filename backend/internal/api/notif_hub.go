package api

import "sync"

type notifHub struct {
	mu      sync.RWMutex
	clients map[int64][]chan []byte
}

func newNotifHub() *notifHub {
	return &notifHub{clients: make(map[int64][]chan []byte)}
}

func (h *notifHub) subscribe(userID int64) chan []byte {
	ch := make(chan []byte, 16)
	h.mu.Lock()
	h.clients[userID] = append(h.clients[userID], ch)
	h.mu.Unlock()
	return ch
}

func (h *notifHub) unsubscribe(userID int64, ch chan []byte) {
	h.mu.Lock()
	defer h.mu.Unlock()
	list := h.clients[userID]
	for i, c := range list {
		if c == ch {
			h.clients[userID] = append(list[:i], list[i+1:]...)
			break
		}
	}
	close(ch)
}

// push sends data to every SSE connection open for userID.
func (h *notifHub) push(userID int64, data []byte) {
	h.mu.RLock()
	defer h.mu.RUnlock()
	for _, ch := range h.clients[userID] {
		select {
		case ch <- data:
		default: // drop if buffer full
		}
	}
}
