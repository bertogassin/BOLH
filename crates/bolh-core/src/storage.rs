use sled::Db;
use std::sync::OnceLock;

static DB: OnceLock<Db> = OnceLock::new();

fn db() -> &'static Db {
    DB.get_or_init(|| {
        sled::open("bolh_data").expect("sled db init")
    })
}

pub fn save_block(block_id: &str, block_data: &str) -> Result<(), String> {
    db().insert(format!("block:{}", block_id).as_bytes(), block_data.as_bytes())
        .map_err(|e| format!("save_block: {}", e))?;
    Ok(())
}

pub fn get_block(block_id: &str) -> Result<Option<String>, String> {
    match db().get(format!("block:{}", block_id).as_bytes()) {
        Ok(Some(ivec)) => {
            let s = String::from_utf8(ivec.to_vec())
                .map_err(|e| format!("utf8: {}", e))?;
            Ok(Some(s))
        }
        Ok(None) => Ok(None),
        Err(e) => Err(format!("get_block: {}", e)),
    }
}

pub fn save_tx(txid: &str, tx_data: &str) -> Result<(), String> {
    db().insert(format!("tx:{}", txid).as_bytes(), tx_data.as_bytes())
        .map_err(|e| format!("save_tx: {}", e))?;
    Ok(())
}

pub fn get_tx(txid: &str) -> Result<Option<String>, String> {
    match db().get(format!("tx:{}", txid).as_bytes()) {
        Ok(Some(ivec)) => {
            let s = String::from_utf8(ivec.to_vec())
                .map_err(|e| format!("utf8: {}", e))?;
            Ok(Some(s))
        }
        Ok(None) => Ok(None),
        Err(e) => Err(format!("get_tx: {}", e)),
    }
}

pub fn set_balance(addr: &str, balance: u64) -> Result<(), String> {
    db().insert(format!("balance:{}", addr).as_bytes(), &balance.to_le_bytes())
        .map_err(|e| format!("set_balance: {}", e))?;
    Ok(())
}

pub fn get_balance(addr: &str) -> Result<u64, String> {
    match db().get(format!("balance:{}", addr).as_bytes()) {
        Ok(Some(ivec)) => {
            if ivec.len() == 8 {
                let arr: [u8; 8] = ivec.as_ref().try_into().unwrap();
                Ok(u64::from_le_bytes(arr))
            } else {
                Ok(0)
            }
        }
        Ok(None) => Ok(0),
        Err(e) => Err(format!("get_balance: {}", e)),
    }
}

pub fn flush() -> Result<(), String> {
    db().flush().map_err(|e| format!("flush: {}", e))?;
    Ok(())
}
