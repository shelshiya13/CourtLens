import { Router, Request, Response } from 'express';
import { getDb } from '../db/client.js';
import { requireAuth } from '../auth/middleware.js';

export const notificationsRouter = Router();

notificationsRouter.get('/', requireAuth, async (req: Request, res: Response) => {
  const db = await getDb();
  const userId = req.user!.userId;

  const notifs = db.prepare<any>(`
    SELECT n.*, c.case_ref, c.title as case_title
    FROM notifications n
    JOIN cases c ON c.id = n.case_id
    WHERE n.user_id = ?
    ORDER BY n.created_at DESC
    LIMIT 50
  `).all(userId);

  const unreadCount = db.prepare<any>(`
    SELECT COUNT(*) as c FROM notifications WHERE user_id = ? AND read_at IS NULL
  `).get(userId)?.c || 0;

  return res.json({ notifications: notifs, unreadCount });
});

notificationsRouter.post('/:id/read', requireAuth, async (req: Request, res: Response) => {
  const notifId = req.params.id;
  const db = await getDb();
  const userId = req.user!.userId;

  db.prepare('UPDATE notifications SET read_at = ? WHERE id = ? AND user_id = ?').run(
    new Date().toISOString(),
    notifId,
    userId
  );

  return res.json({ success: true });
});

notificationsRouter.post('/read-all', requireAuth, async (req: Request, res: Response) => {
  const db = await getDb();
  const userId = req.user!.userId;

  db.prepare('UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL').run(
    new Date().toISOString(),
    userId
  );

  return res.json({ success: true });
});
