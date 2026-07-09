const request = require('supertest');
const app = require('../index');
const child_process = require('child_process');
const EventEmitter = require('events');

jest.mock('child_process');

describe('Pengujian API ElToolkitDeRWBU', () => {

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('POST /api/ytdlp/info', () => {
        it('Skenario Negatif: Harus merespon 400 jika URL kosong', async () => {
            const res = await request(app).post('/api/ytdlp/info').send({});
            expect(res.status).toBe(400);
            expect(res.body.error).toBe('URL required');
        });

        it('Skenario Positif: Harus mem-parsing array resolusi secara akurat', async () => {
            const mockStdout = JSON.stringify({
                title: "Video Edukasi Mock",
                formats: [
                    { format_note: "1080p", ext: "mp4", height: 1080, vcodec: "avc1" },
                    { height: 720, ext: "webm", vcodec: "vp9" },
                    { format_note: "144p", ext: "mp4", height: 144, vcodec: "avc1" }
                ]
            });

            const mockProc = new EventEmitter();
            mockProc.killed = false;
            mockProc.kill = jest.fn();

            child_process.execFile.mockImplementation((cmd, args, options, callback) => {
                callback(null, mockStdout, '');
                return mockProc;
            });

            const res = await request(app).post('/api/ytdlp/info').send({ url: 'https://youtube.com/watch?v=mock' });
            
            expect(res.status).toBe(200);
            expect(res.body.title).toBe('Video Edukasi Mock');
            expect(res.body.resolutions).toEqual([1080, 720, 144]);
        });
    });

    describe('POST /api/run', () => {
        
        it('Skenario Negatif: Harus mengirimkan stream error jika modul invalid', async () => {
            const res = await request(app).post('/api/run').send({ module: 'hack' });
            expect(res.headers['content-type']).toContain('text/event-stream');
            expect(res.text).toContain('Error: Module tidak ditemukan');
            expect(res.text).toContain('"done":true');
        });

        it('Skenario Positif: Modul ffmpeg-trim spawn argumen benar', async () => {
            const mockSpawn = new EventEmitter();
            mockSpawn.stdout = new EventEmitter();
            mockSpawn.stderr = new EventEmitter();
            
            child_process.spawn.mockImplementation((cmd, args) => {
                expect(cmd).toBe('ffmpeg');
                expect(args).toContain('00:00:10');
                return mockSpawn;
            });

            const promise = request(app).post('/api/run').send({
                module: 'ffmpeg-trim',
                data: {
                    inputFile: 'C:/test.mp4',
                    outputDir: 'C:/out',
                    startTime: '00:00:10',
                    endTime: '00:00:20'
                }
            });

            setTimeout(() => mockSpawn.emit('close', 0), 50);

            const res = await promise;
            expect(res.text).toContain('Menjalankan perintah');
            expect(res.text).toContain('"done":true');
        });
        // Skenario kongesti dihapus dari unit test karena keterbatasan framework supertest dalam menangani multiple hanging SSE streams
        
        it('Skenario Zombie Process: Memastikan proses di-kill jika klien memutus koneksi', async () => {
            const mockSpawn = new EventEmitter();
            mockSpawn.stdout = new EventEmitter();
            mockSpawn.stderr = new EventEmitter();
            mockSpawn.kill = jest.fn();
            child_process.spawn.mockReturnValue(mockSpawn);

            const req = request(app).post('/api/run').send({ module: 'ffmpeg-trim', data: { inputFile: 'a', outputDir: 'b', startTime: '1', endTime: '2' } });
            
            // Kita tunggu sedikit, lalu abort
            setTimeout(() => {
                req.abort();
            }, 100);

            try { await req; } catch (e) {}

            await new Promise(r => setTimeout(r, 100));
            expect(mockSpawn.kill).toHaveBeenCalledWith('SIGKILL');
        });
    });
});
