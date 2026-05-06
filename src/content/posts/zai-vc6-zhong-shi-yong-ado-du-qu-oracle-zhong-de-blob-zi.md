---
title: 在VC6中使用ADO读取Oracle中的BLOB字段
slug: zai-vc6-zhong-shi-yong-ado-du-qu-oracle-zhong-de-blob-zi
date: "2005-10-13T20:03:00.000Z"
tags:
  - 数据库
source: cnblogs
sourceUrl: https://www.cnblogs.com/rib06/archive/2005/10/13/254233.html
draft: false
---

今天尝试将存储于Oracle（版本：9.0.1.1.1）中BLOB字段里的图像文件读出来，文件量很小，不到10K。使用vc6+ADO，使用控制台程序初步尝试如下：

::CoInitialize(NULL); //初始化OLE/COM库环境
\_ConnectionPtr m_pConn;
try
![](/posts/zai-vc6-zhong-shi-yong-ado-du-qu-oracle-zhong-de-blob-zi/img-1.gif){
    HRESULT hr = m_pConn.CreateInstance("ADODB.Connection");
    if(FAILED(hr))
    ![](/posts/zai-vc6-zhong-shi-yong-ado-du-qu-oracle-zhong-de-blob-zi/img-1.gif){
        cout\<\<"Create ADO Connection failed"\<\<endl;
        exit(0);
    }

    CString oracleConnectionString, oracleUserID, oraclePassword;
    oracleConnectionString = "Provider=MSDAORA;Data Source=STUDENT;";
    oracleUserID = "stuinfo";
    oraclePassword = "stuinfo";

    hr = m_pConn-\>Open((\_bstr_t)oracleConnectionString, (\_bstr_t)oracleUserID, (\_bstr_t)oraclePassword, adModeUnknown);
    if (FAILED(hr))
    ![](/posts/zai-vc6-zhong-shi-yong-ado-du-qu-oracle-zhong-de-blob-zi/img-1.gif){
        cout\<\<"Can not connect to database"\<\<endl;
        exit(0);
    }
    else
    ![](/posts/zai-vc6-zhong-shi-yong-ado-du-qu-oracle-zhong-de-blob-zi/img-1.gif){
        cout\<\<"Connect to database successfully!"\<\<endl;
    }
}
catch(\_com_error e)
![](/posts/zai-vc6-zhong-shi-yong-ado-du-qu-oracle-zhong-de-blob-zi/img-1.gif){
    CString errMsg = e.ErrorMessage();
    cout\<\<errMsg\<\<endl;
    exit(0);
}

\_RecordsetPtr m_pRecordset;
try
![](/posts/zai-vc6-zhong-shi-yong-ado-du-qu-oracle-zhong-de-blob-zi/img-1.gif){

    HRESULT hr = m_pRecordset.CreateInstance("ADODB.Recordset");
    if (FAILED(hr))
    ![](/posts/zai-vc6-zhong-shi-yong-ado-du-qu-oracle-zhong-de-blob-zi/img-1.gif){
        cout\<\<"Create ADO Recordset failed"\<\<endl;
        exit(0);
    }

    CString strSQL = "select \* from stuinfotable where stuid=1";
    // stuinfotable表中有一个blob类型字段stupic存储照片
    BSTR bstrSQL = strSQL.AllocSysString();
    hr = m_pRecordset-\>Open(bstrSQL, (IDispatch\*)m_pConn, adOpenDynamic, adLockOptimistic, adCmdText);
    if (FAILED(hr))
    ![](/posts/zai-vc6-zhong-shi-yong-ado-du-qu-oracle-zhong-de-blob-zi/img-1.gif){
        cout\<\<"Open ADO Recordset failed"\<\<endl;
        exit(0);
    }
}
catch(\_com_error e)
![](/posts/zai-vc6-zhong-shi-yong-ado-du-qu-oracle-zhong-de-blob-zi/img-1.gif){
    CString errMsg = e.ErrorMessage();
    cout\<\<errMsg\<\<endl;
    exit(0);
}

long lDataSize = m_pRecordset-\>GetFields()-\>GetItem("stupic")-\>ActualSize;
cout\<\<"BLOB length is "\<\<lDataSize\<\<endl;

if(lDataSize \> 0)
![](/posts/zai-vc6-zhong-shi-yong-ado-du-qu-oracle-zhong-de-blob-zi/img-1.gif){
    \_variant_t varBLOB;
    varBLOB = m_pRecordset-\>GetFields()-\>GetItem("stupic")-\>GetChunk(lDataSize);

    //判断数据类型是否正确
    if(varBLOB.vt == (VT_ARRAY \| VT_UI1))
    ![](/posts/zai-vc6-zhong-shi-yong-ado-du-qu-oracle-zhong-de-blob-zi/img-1.gif){
        BYTE \*pBuf = NULL;
        //得到指向数据的指针
        SafeArrayAccessData(varBLOB.parray, (void \*\*)&pBuf);
        /\*\*//\*\*\*这里是对pBuf数据的处理\*\*\*/
        CFile targetImageFile;
        CFileException eTargetImageFile;
        CString targetImageFileName = "C:\\stupicture.bmp";

        if (!targetImageFile.Open(targetImageFileName, CFile::modeCreate \| CFile::modeWrite, &eTargetImageFile))
        ![](/posts/zai-vc6-zhong-shi-yong-ado-du-qu-oracle-zhong-de-blob-zi/img-1.gif){
            cout\<\<"Create file failed"\<\<endl;
            exit(0);
        }
        else
        ![](/posts/zai-vc6-zhong-shi-yong-ado-du-qu-oracle-zhong-de-blob-zi/img-1.gif){
            // 打开文件成功，准备写入
            targetImageFile.Write((BYTE \*)pBuf, lDataSize);
            cout\<\<"Write stupicture.bmp file successfully!"\<\<endl;
        }
        SafeArrayUnaccessData (varBLOB.parray);
    }
}

// 断开ADO连接
if (m_pConn != NULL)
![](/posts/zai-vc6-zhong-shi-yong-ado-du-qu-oracle-zhong-de-blob-zi/img-1.gif){
    m_pConn-\>Close();
    m_pConn = NULL;
    cout\<\<"ADO connection closed successfully"\<\<endl;
}

::CoUninitialize();//释放程序占用的COM 资源

我认为上面的代码不应该有任何问题，但就像往常一样，它在第二个try块的Open recordset语句处抛出了一个00C9132C异常，内容为“未指定的错误”。

    并且经实验发现，只要SQL语句中包含对BLOB字段的查询请求，那么这里就一定会抛出这个异常。

    上网翻了一下，发现普天之下与我同病相怜者寥寥，英文论坛里也是只见到几个扔在那里没人管的帖子，配上网站绿色的背景，让我想起了本科时一次泡了很久忘了洗的衣服:-P    不过最后还是在CSDN中全文检索出了一点蛛丝马迹。那是2003年的1849205号帖子，楼主也遇到了同样的问题，楼中bysen给出了提示：

**回复人： bysen() ( ) 信誉：98  2003-05-29 13:30:54Z  得分:40**

在oracle中blob是不能这样select的，你在sql/plus中执行一下你的sql语句就知道了，是不能执行的，对blob的操作只能用dbms_lob包进行。
但是，在ado中这个sql语句却是能执行的，但前提是你的表中blob的值应该是empty_blob(),
而不是NULL，你直接用m_Recordset-\>open()方法打开试试，看看你的错误是在哪条语句。

Top

### 回复人： bysen() ( ) 信誉：98  2003-05-29 13:37:50Z  得分:0

但是你要得到blob中的值还是要用GetChunk()命令
在ado中select的blob只是起定位的作用
而且Provider=SQLOLEDB.1要改为OraOLEDB.Oracle.1,否则getchunk命令可能不能执行

    而且楼主最后自己回了一帖:
**回复人： cnwhsg(sun) ( ) 信誉：89  2003-05-29 14:42:18Z  得分:0**

我这样修改了一下就没有问题了，
   我把连接字符串的Provider=MSDAORA，改为Provider=OraOLEDB.Oracle.1，就可以了。现在我点晕了，这个Provider到底怎么写了，好象写法十分多了，有地方详细说明的吗？

    我刚开始看到这个回复的时候还没当回事，因为Connection是正常的，而且过去连接数据库也没有因为Provider写的不对出过问题，所以我把注意力都放在了Recordset的Open方法上面，但是却怎么改也不行。
    折腾到晚饭前，已经是黔驴技穷，随手改了一下Provider为OraOLEDB.Oracle.1，单步到

m_pRecordset-\>Open(bstrSQL, (IDispatch\*)m_pConn, adOpenDynamic, adLockOptimistic, adCmdText);

PIU~的一下就过去了，而且也正常生成了图片文件    现在问题就很清楚了，我必须弄明白这个过去从没有给予充分重视的Provider的真正含义。
