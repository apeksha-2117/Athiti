let ioInstance = null;

export function registerSocketIO(io) {
  ioInstance = io;
}

export function getIO() {
  return ioInstance;
}

export function emitToHotel(hotelId, event, payload) {
  if (!ioInstance) return;
  ioInstance.to(`hotel:${hotelId}`).emit(event, payload);
}

export function emitToRole(role, event, payload) {
  if (!ioInstance) return;
  ioInstance.to(`role:${role}`).emit(event, payload);
}

export function emitToUser(userId, event, payload) {
  if (!ioInstance) return;
  ioInstance.to(`user:${userId}`).emit(event, payload);
}
