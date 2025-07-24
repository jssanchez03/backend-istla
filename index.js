require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const app = express();

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

app.use(express.static('public', {
    setHeaders: function (res, path, stat) {
        if (path.endsWith('.docx')) {
            res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        }
    }
}));

const routes = require('./src/routes');
app.use('/api', routes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en el puerto ${PORT}`);
});
