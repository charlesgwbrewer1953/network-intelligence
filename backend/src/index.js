require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { requestLogger, logger } = require('./middleware/logger');

const devicesRouter = require('./routes/devices');
const scansRouter = require('./routes/scans');
const observationsRouter = require('./routes/observations');
const diagnosticsRouter = require('./routes/diagnostics');
const networksRouter = require('./routes/networks');
const networkInterfacesRouter = require('./routes/network-interfaces');
const networkRelationshipsRouter = require('./routes/network-relationships');

const app = express();
const PORT = process.env.PORT || 3101;

app.use(cors());
app.use(express.json());
app.use(requestLogger);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/devices', devicesRouter);
app.use('/api/scans', scansRouter);
app.use('/api/observations', observationsRouter);
app.use('/api/diagnostics', diagnosticsRouter);
app.use('/api/networks', networksRouter);
app.use('/api/network-interfaces', networkInterfacesRouter);
app.use('/api/network-relationships', networkRelationshipsRouter);

app.use((err, req, res, next) => {
  logger.error('unhandled error', { error: err.message, stack: err.stack });
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  logger.info(`Backend running on port ${PORT}`);
});
