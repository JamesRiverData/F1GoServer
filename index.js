const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

app.use(express.json()); // allows parsing JSON body (important for POST/PUT/PATCH)
app.use(express.urlencoded({ extended: true })); // allows parsing form data (important for login or forms)


// Store session ID in memory
let sessionId = null;

// Login function
async function loginAndGetSessionId() {
    console.log('Loging in');
    const loginUrl = 'https://jamesriver.fellowshiponego.com:443/api/user/login';
    
    try {
        const response = await axios.post(loginUrl, {
            username: 'jrcapi',
            password: 'peycal2025'
        });

        // Assume response looks like { session_id: 'abc123' }
        sessionId = response.data.data.session_id;
        console.log('Got session ID:', sessionId);
    } catch (error) {
        console.error('Login failed', error.response?.status, error.message);
        throw new Error('Failed to login to FellowshipOneGo API');
    }
}

// General forwardRequest function
async function forwardRequest(targetUrl, req, res) {
    try {
        if (!sessionId) {
            await loginAndGetSessionId();
        }

        // Clone and clean headers from the incoming request
        const headers = {
            'X-SessionID': sessionId,
            'Accept': 'application/json',
            ...req.headers
        };
        delete headers.host;  // Remove host header to prevent mismatch

        const axiosConfig = {
            method: req.method,
            url: targetUrl,
            headers,
            data: req.body // forward body (important for POST/PUT/PATCH)
        };

        const apiResponse = await axios(axiosConfig);

        res.status(apiResponse.status).json(apiResponse.data);
    } catch (error) {
        console.error(error.response?.status, error.message);

        if (error.response?.status === 401) {
            console.log('Session expired, re-logging in...');
            sessionId = null;
            try {
                await loginAndGetSessionId();

                // Prepare headers again without host
                const headers = {
                    'X-SessionID': sessionId,
                    'Accept': 'application/json',
                    ...req.headers
                };
                delete headers.host;

                const retryResponse = await axios({
                    method: req.method,
                    url: targetUrl,
                    headers,
                    data: req.body
                });
                return res.status(retryResponse.status).json(retryResponse.data);
            } catch (retryError) {
                console.error('Retry failed', retryError.response?.status, retryError.message);
                return res.status(retryError.response?.status || 500).send('Error after retry');
            }
        }

        res.status(error.response?.status || 500).send('Error fetching data');
    }
}



app.use('/proxy/v1', async (req, res) => {
    const targetPath = req.originalUrl.replace('/proxy/v1/', '');
    const targetUrl = `https://jamesriver.fellowshiponego.com/api/${targetPath}`;
    forwardRequest(targetUrl, req, res);
});

app.use('/proxy/v2', async (req, res) => {
    const targetPath = req.originalUrl.replace('/proxy/v2/', '');
    const targetUrl = `https://jamesriver.fellowshiponego.com/api/v2/${targetPath}`;
    forwardRequest(targetUrl, req, res);
});

app.use('/proxy/v3', async (req, res) => {
    const targetPath = req.originalUrl.replace('/proxy/v3/', '');
    const targetUrl = `https://jamesriver.fellowshiponego.com/api/v3/${targetPath}`;
    forwardRequest(targetUrl, req, res);
});


app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
