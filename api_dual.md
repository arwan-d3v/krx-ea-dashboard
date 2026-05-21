//API Mimo Pro

API         = tp-s8pjg2nc9hyq2xm5itn6t25uu3szwwehcujevw8vcx3emfs6
base url    = https://token-plan-sgp.xiaomimimo.com/v1
models      = 
The default values and parameter ranges of temperature and top_p for different models are as follows:

Model Name	temperature	top_p
mimo-v2.5-pro
mimo-v2-pro	
Default value: 1.0
Range: [0, 1.5]
Default value: 0.95
Range: [0.01, 1.0]
mimo-v2.5
mimo-v2-omni	
Default value: 1.0
Range: [0, 1.5]
Default value: 0.95
Range: [0.01, 1.0]
mimo-v2.5-tts
mimo-v2.5-tts-voicedesign
mimo-v2.5-tts-voiceclone
mimo-v2-tts	
Default value: 0.6
Range: [0, 1.5]
Default value: 0.95
Range: [0.01, 1.0]
mimo-v2-flash	
Default value: 0.3
Range: [0, 1.5]
Default value: 0.95
Range: [0.01, 1.0]
We recommend that you set parameter values according to task type, and you can refer to the following recommended values.

The recommended values for the mimo-v2-flash model are as follows:

Task Type	temperature	top_p
Vibe Coding	0.3	0.95
Function Call	0.3	0.95
General Conversation	0.8	0.95
Creative Writing	0.8	0.95
WebDev	0.8	0.95
Mathematical Reasoning	1	0.95
The recommended values for the temperature and top_p parameters of the mimo-v2.5-pro, mimo-v2.5, mimo-v2-pro, and mimo-v2-omni models for the above tasks are 1 and 0.95, respectively.




//API DeepSeek

API         = sk-c11487b54ac74e958eda88605ef8ae25
base url    = https://api.deepseek.com
models      = 	
deepseek-v4-flash
deepseek-v4-pro

