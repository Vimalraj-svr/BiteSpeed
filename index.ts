import Hapi from '@hapi/hapi';
import ContactRoutes from './api/contact/routes';

require('dotenv').config();

const init = async () => {
    const server = Hapi.server({
        port: process.env.PORT,
        host: process.env.HOST
    });

    const contactRoutes = new ContactRoutes();
    await contactRoutes.register(server);

    try {
        await server.start();
        console.log('Server running on %s', server.info.uri);
    } catch (err) {
        console.error('Error starting server:', err);
    }
};

process.on('unhandledRejection', (err) => {
    console.error(err);
    process.exit(1);
});

init();
